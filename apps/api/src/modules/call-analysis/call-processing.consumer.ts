import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { TranscriptionService } from '../transcription/transcription.service';
import { CallAnalysisService } from './call-analysis.service';
import { CALL_PROCESSING_QUEUE } from '../transcription/constants';
import { CallProcessingJobData } from './dto/call-processing-job.dto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CallRecordingService } from '../voip/call-recording.service';
import { ConnectwiseManageService } from '../connectwise-manage/connectwise-manage.service';

import { CallRepository } from './repositories/call.repository';
import { CompanyRepository } from './repositories/company.repository';
import { CallAnalysisRepository } from './repositories/call-analysis.repository';
import { ProcessingLogRepository } from './repositories/processing-log.repository';
import { AgentRepository } from './repositories/agent.repository';
import { Call, Company, Agent, Prisma } from '@db'; // Added Prisma
import { dayjs } from '../../lib/dayjs';
import { EmbeddingService } from '../embedding/embedding.service';
import { TextChunkingService } from '../text-chunking/text-chunking.service';
import { CallTranscriptEmbeddingRepository } from './repositories/call-transcript-embedding.repository';
import { ConfigService } from '@nestjs/config';
@Injectable()
@Processor(CALL_PROCESSING_QUEUE, { concurrency: 5 })
export class CallProcessingConsumer extends WorkerHost {
  private readonly logger = new Logger(CallProcessingConsumer.name);

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly callAnalysisService: CallAnalysisService, // This is the existing service for analysis logic
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly callRecordingService: CallRecordingService,
    private readonly connectwise: ConnectwiseManageService,
    private readonly callRepository: CallRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly callAnalysisRepository: CallAnalysisRepository, // This is the new repository for DB ops
    private readonly processingLogRepository: ProcessingLogRepository,
    private readonly agentRepository: AgentRepository,
    private readonly embeddingService: EmbeddingService,
    private readonly textChunkingService: TextChunkingService,
    private readonly callTranscriptEmbeddingRepository: CallTranscriptEmbeddingRepository,
    private readonly configService: ConfigService, // For chunk size/overlap
  ) {
    super();
  }

  async process(job: Job<CallProcessingJobData, any, string>): Promise<any> {
    const { callRecordingId, recordgroup, recordid } = job.data; // callRecordingId is used as callSid
    this.logger.log(
      `Processing job ${job.id} for call SID: ${callRecordingId}`,
    );

    // Removed $transaction wrapper
    let callEntity: Call | null = null;
    let companyEntity: Company | null = null;

    try {
      const recordingResponse =
        await this.callRecordingService.fetchCallRecording(
          callRecordingId,
          recordgroup,
          recordid,
        );
      const startTime = dayjs
        .unix(Number(recordingResponse.data.start))
        .toISOString();
      const endTime = dayjs
        .unix(Number(recordingResponse.data.end))
        .toISOString();

      const recordingData = recordingResponse.data;
      const audioBase64 = recordingData.data;
      const mimeType = recordingData.mimetype || 'audio/mpeg';

      // 2. Upload fetched audio to blob storage
      const blobFileName = `call-recordings/${callRecordingId}.${
        mimeType.split('/')[1] || 'mp3'
      }`;
      const audioBufferForUpload = Buffer.from(audioBase64, 'base64');

      const internalExtensionNumber =
        await this.callAnalysisService.extractInternalPhoneNumber(
          recordingData,
        );

      // Fetch internal extension name if available
      const extensionInfo = await this.callRecordingService.getExtension(
        internalExtensionNumber,
      );
      const internalExtensionName = extensionInfo?.callername_internal || null;

      // Handle Agent - check if agent exists, if not create it
      let agentEntity: Agent | null = null;
      if (internalExtensionNumber && internalExtensionName) {
        // First check if agent exists by extension number
        agentEntity = await this.agentRepository.findByExtension(
          internalExtensionNumber,
        );

        if (!agentEntity) {
          // Create new agent if not found
          agentEntity = await this.agentRepository.create({
            name: internalExtensionName,
            extension: internalExtensionNumber,
          });
          this.logger.log(
            `Created new Agent: ${internalExtensionName} (Extension: ${internalExtensionNumber})`,
          );
        } else {
          this.logger.log(
            `Found existing Agent: ${agentEntity.name} (Extension: ${agentEntity.extension})`,
          );
        }
      }

      const duration = dayjs(endTime).diff(dayjs(startTime), 'seconds');
      // Step 0: Check for Existing Call
      const existingCall = await this.callRepository.findByCallSid(
        callRecordingId,
      );
      if (existingCall && existingCall.callStatus === 'COMPLETED') {
        this.logger.warn(
          `Call SID ${callRecordingId} (Job ${job.id}) has already been COMPLETED. Skipping.`,
        );
        await this.processingLogRepository.create({
          callId: existingCall.id,
          companyId: existingCall.companyId,
          status: 'LOG_INFO',
          message: `Skipped: Call SID ${callRecordingId} already COMPLETED.`,
        });
        return { jobId: job.id, message: 'Skipped, already COMPLETED.' };
      }

      if (existingCall) {
        callEntity = existingCall;
        this.logger.log(
          `Resuming processing for existing Call ID ${callEntity.id} (SID: ${callRecordingId})`,
        );
        callEntity = await this.callRepository.update(callEntity.id, {
          callStatus: 'PROCESSING',
          ...(agentEntity &&
            !callEntity.agentsId && { agentsId: agentEntity.id }),
        });
      } else {
        // Create a new Call record if it doesn't exist
        callEntity = await this.callRepository.create({
          callSid: callRecordingId,
          // startDate from job data
          startTime,
          endTime,
          duration,
          callStatus: 'PROCESSING',
          agentsId: agentEntity?.id,

          // endTime and duration will be set upon completion
        });
        this.logger.log(
          `Created new Call record with ID: ${callEntity.id} for SID: ${callRecordingId}`,
        );
      }

      await this.processingLogRepository.create({
        callId: callEntity.id,
        status: 'LOG_INFO',
        message: `Job ${job.id} started processing for Call ID: ${callEntity.id}.`,
      });

      // 1. Fetch full recording data
      this.logger.log(`Fetching recording data for ${callRecordingId}`);

      if (!recordingResponse?.data?.data) {
        throw new Error(
          'Failed to fetch recording data or audio data missing.',
        );
      }
      await this.processingLogRepository.create({
        callId: callEntity.id,
        status: 'LOG_INFO',
        message: 'Recording data fetched.',
      });

      const blobPath = await this.storageService.uploadFile(
        blobFileName,
        audioBufferForUpload,
        mimeType,
      );
      callEntity = await this.callRepository.update(callEntity.id, {
        recordingUrl: blobFileName,
      });
      await this.processingLogRepository.create({
        callId: callEntity.id,
        status: 'LOG_INFO',
        message: `Audio uploaded to ${blobPath}`,
      });

      // 3. Transcribe audio
      const transcriptionResult = await this.transcriptionService.transcribeAudio(
        audioBase64,
        mimeType,
      );
      const transcript = transcriptionResult.text;
      const transcriptionMetadata = transcriptionResult.metadata;
      if (!transcript || transcript.trim() === '') {
        this.logger.error(
          `Transcription resulted in empty text for Call ID ${callEntity.id}. Marking as TRANSCRIPTION_FAILED.`,
        );
        await this.processingLogRepository.create({
          callId: callEntity.id,
          status: 'LOG_ERROR',
          message: 'Transcription failed or returned empty text.',
        });
        await this.callRepository.update(callEntity.id, {
          callStatus: 'TRANSCRIPTION_FAILED', // New status
        });
        await this.processingLogRepository.create({
          callId: callEntity.id,
          status: 'LOG_SUCCESS', // Log success for the job itself, but call is marked failed
          message: `Job ${job.id} processing COMPLETED (transcription failed).`,
        });
        // Do not throw error here to allow job to complete in BullMQ,
        // but the call itself is marked as failed.
        return {
          jobId: job.id,
          message: 'Transcription failed or returned empty text.',
          callId: callEntity.id,
        };
      }
      await this.processingLogRepository.create({
        callId: callEntity.id,
        status: 'LOG_INFO',
        message: 'Transcription successful.',
      });

      // Store full transcript in Azure Blob Storage
      const transcriptFileName = `transcripts/${callRecordingId}.txt`;
      const transcriptBuffer = Buffer.from(transcript, 'utf-8');
      try {
        await this.storageService.uploadFile(
          transcriptFileName,
          transcriptBuffer,
          'text/plain',
        );
        callEntity = await this.callRepository.update(callEntity.id, {
          transcriptUrl: transcriptFileName,
        });
        await this.processingLogRepository.create({
          callId: callEntity.id,
          status: 'LOG_INFO',
          message: `Transcript uploaded to ${transcriptFileName}`,
        });
      } catch (storageError) {
        this.logger.error(
          `Failed to upload transcript for Call ID ${callEntity.id}: ${storageError.message}`,
          storageError.stack,
        );
        await this.processingLogRepository.create({
          callId: callEntity.id,
          status: 'LOG_ERROR',
          message: `Failed to upload transcript: ${storageError.message}`,
        });
        // Decide if this is a critical failure, for now, we continue to embedding if transcript is available
      }

      // LLM-based agent identification fallback
      // If CDR extraction didn't find an agent, try identifying from the transcript
      if (!agentEntity && transcript) {
        this.logger.log(
          `[AgentAttribution/LLM] No agent from CDR for ${callRecordingId}, attempting LLM identification...`,
        );
        const llmResult = await this.callAnalysisService.identifyAgentFromTranscript(
          transcript,
          callRecordingId,
        );

        if (llmResult) {
          // Look up the agent by name
          const agents = await this.agentRepository.findMany({
            where: { name: { equals: llmResult.agentName, mode: 'insensitive' } },
          });
          
          if (agents.length > 0) {
            agentEntity = agents[0];
            callEntity = await this.callRepository.update(callEntity.id, {
              agentsId: agentEntity.id,
            });
            this.logger.log(
              `[AgentAttribution/LLM] Linked ${callRecordingId} to ${agentEntity.name} (confidence: ${llmResult.confidence}, reason: ${llmResult.reasoning})`,
            );
            await this.processingLogRepository.create({
              callId: callEntity.id,
              status: 'LOG_INFO',
              message: `Agent identified via LLM: ${agentEntity.name} (confidence: ${llmResult.confidence}). Reason: ${llmResult.reasoning}`,
            });
          }
        } else {
          this.logger.log(
            `[AgentAttribution/LLM] No agent identified from transcript for ${callRecordingId} (likely voicemail/IVR)`,
          );
          await this.processingLogRepository.create({
            callId: callEntity.id,
            status: 'LOG_INFO',
            message: 'No agent identified from CDR or transcript (voicemail/IVR/automated).',
          });
        }
      }

      // Chunk and Embed Transcript
      // Skip embeddings when SKIP_EMBEDDINGS=true (re-enable when Semantic Call Search is implemented — see PLAN.md #16)
      const skipEmbeddings = this.configService.get<string>('SKIP_EMBEDDINGS', 'false').toLowerCase() === 'true';
      
      if (skipEmbeddings) {
        this.logger.log(`Skipping embeddings for Call ID ${callEntity.id} (SKIP_EMBEDDINGS=true)`);
        await this.processingLogRepository.create({
          callId: callEntity.id,
          status: 'LOG_INFO',
          message: 'Embedding generation skipped (SKIP_EMBEDDINGS=true).',
        });
      } else {
        const chunkSize = this.configService.get<number>(
          'EMBEDDING_CHUNK_SIZE_TOKENS',
          7500,
        );
        const chunkOverlap = this.configService.get<number>(
          'EMBEDDING_CHUNK_OVERLAP_TOKENS',
          200,
        );
        const transcriptChunks = this.textChunkingService.chunkText(
          transcript,
          chunkSize,
          chunkOverlap,
        );

        if (transcriptChunks && transcriptChunks.length > 0) {
          for (let i = 0; i < transcriptChunks.length; i++) {
            const chunk = transcriptChunks[i];
            try {
              const embeddingVector =
                await this.embeddingService.generateEmbedding(chunk);
              if (embeddingVector && embeddingVector.length > 0) {
                await this.callTranscriptEmbeddingRepository.create({
                  callId: callEntity.id,
                  chunkSequence: i,
                  embedding: embeddingVector, // Removed cast
                  modelName: 'text-embedding-ada-002', // Or from config
                });
                await this.processingLogRepository.create({
                  callId: callEntity.id,
                  status: 'LOG_INFO',
                  message: `Embedding generated and stored for chunk ${i + 1}/${
                    transcriptChunks.length
                  }.`,
                });
              } else {
                this.logger.warn(
                  `Embedding for chunk ${i + 1} was empty. Skipping storage.`,
                );
                await this.processingLogRepository.create({
                  callId: callEntity.id,
                  status: 'LOG_WARN',
                  message: `Embedding for chunk ${i + 1}/${
                    transcriptChunks.length
                  } was empty. Skipped storage.`,
                });
              }
            } catch (embeddingError) {
              this.logger.error(
                `Failed to generate or store embedding for chunk ${
                  i + 1
                } of Call ID ${callEntity.id}: ${embeddingError.message}`,
                embeddingError.stack,
              );
              await this.processingLogRepository.create({
                callId: callEntity.id,
                status: 'LOG_ERROR',
                message: `Failed to generate/store embedding for chunk ${i + 1}/${
                  transcriptChunks.length
                }: ${embeddingError.message}`,
              });
            }
          }
        } else {
          this.logger.warn(
            `No chunks generated for transcript of Call ID ${callEntity.id}. Skipping embedding.`,
          );
          await this.processingLogRepository.create({
            callId: callEntity.id,
            status: 'LOG_WARN',
            message: 'No transcript chunks generated. Skipped embedding process.',
          });
        }
      }

      // 4. Handle Company
      const externalPhoneNumber =
        await this.callAnalysisService.extractExternalPhoneNumber(
          recordingData,
        ); // Existing service method

      if (!externalPhoneNumber) {
        this.logger.warn(
          `No external phone number extracted for Call ID ${callEntity.id}. Marking as internal and skipping further company processing and analysis.`,
        );
        await this.processingLogRepository.create({
          callId: callEntity.id,
          status: 'LOG_INFO',
          message: 'No external phone number found. Marked as internal call.',
        });

        await this.callRepository.update(callEntity.id, {
          callStatus: 'INTERNAL_CALL_SKIPPED', // New status
        });
        await this.processingLogRepository.create({
          callId: callEntity.id,
          status: 'LOG_SUCCESS',
          message: `Job ${job.id} processing COMPLETED (marked as internal).`,
        });
        return {
          jobId: job.id,
          message: 'Call marked as internal and skipped further processing.',
          callId: callEntity.id,
        };
      }

      // Proceed with company lookup if phone number exists
      try {
        const companyFromConnectwise =
          await this.connectwise.getCompanyByPhoneNumber(externalPhoneNumber);

        if (companyFromConnectwise) {
          companyEntity = await this.companyRepository.findOrCreate(
            companyFromConnectwise.id.toString(),
            companyFromConnectwise.name,
          );
          callEntity = await this.callRepository.update(callEntity.id, {
            companyId: companyEntity.id,
          });
          await this.processingLogRepository.create({
            callId: callEntity.id,
            companyId: companyEntity.id,
            status: 'LOG_INFO',
            message: `Company identified/created: ${companyEntity.name} (ID: ${companyEntity.id})`,
          });
        } else {
          await this.processingLogRepository.create({
            callId: callEntity.id,
            status: 'LOG_INFO',
            message: `No ConnectWise company found for phone ${externalPhoneNumber}`,
          });
        }
      } catch (cwError) {
        if (cwError.message?.includes('Phone Number is required')) {
          this.logger.warn(
            `ConnectWise lookup failed due to missing phone number for Call ID ${callEntity.id} (should have been caught earlier). Marking as internal. Error: ${cwError.message}`,
          );
          await this.processingLogRepository.create({
            callId: callEntity.id,
            status: 'LOG_INFO',
            message: `ConnectWise lookup failed (missing phone number). Marked as internal call. Error: ${cwError.message}`,
          });
          await this.callRepository.update(callEntity.id, {
            callStatus: 'INTERNAL_CALL_SKIPPED',
          });
          await this.processingLogRepository.create({
            callId: callEntity.id,
            status: 'LOG_SUCCESS',
            message: `Job ${job.id} processing COMPLETED (marked as internal due to CW error).`,
          });
          return {
            jobId: job.id,
            message:
              'Call marked as internal due to ConnectWise phone number error.',
            callId: callEntity.id,
          };
        }
        // For other ConnectWise errors, re-throw to be caught by the main try-catch
        throw cwError;
      }

      // 5. Analyze transcript
      const promptTranscript = `
      client_name: ${companyEntity?.name || 'Not found'}\n
      Phone Number: ${externalPhoneNumber}\n
      Transcript: ${transcript}`;

      const { analysis, promptTemplateId, llmConfigId, analysisProvider, analysisModel } = 
        await this.callAnalysisService.analyzeTranscript(promptTranscript);
      
      await this.processingLogRepository.create({
        callId: callEntity.id,
        companyId: companyEntity?.id,
        status: 'LOG_INFO',
        message: 'Transcript analysis successful.',
      });

      // 6. Save analysis result with historical tracking
      const callAnalysisEntity = await this.callAnalysisRepository.create({
        callId: callEntity.id,
        companyId: companyEntity?.id,
        data: analysis,
        promptTemplateId,
        llmConfigId,
      });
      callEntity = await this.callRepository.update(callEntity.id, {
        callAnalysisId: callAnalysisEntity.id,
      });
      await this.processingLogRepository.create({
        callId: callEntity.id,
        companyId: companyEntity?.id,
        status: 'LOG_SUCCESS',
        message: `Call analysis saved. Analysis ID: ${callAnalysisEntity.id}`,
      });

      // Save LLM pipeline metadata for debugging/R&D
      const processingMetadata = {
        transcription: {
          provider: transcriptionMetadata.transcriptionProvider,
          model: transcriptionMetadata.transcriptionModel,
        },
        refinement: transcriptionMetadata.refinementProvider ? {
          provider: transcriptionMetadata.refinementProvider,
          model: transcriptionMetadata.refinementModel,
        } : { provider: 'skipped', model: null },
        analysis: {
          provider: analysisProvider,
          model: analysisModel,
        },
        embeddings: {
          provider: skipEmbeddings ? 'skipped' : 'openai',
          model: skipEmbeddings ? null : 'text-embedding-3-small',
        },
        processedAt: new Date().toISOString(),
      };

      await this.callRepository.update(callEntity.id, {
        callStatus: 'COMPLETED',
        processingMetadata,
      });

      await this.processingLogRepository.create({
        callId: callEntity.id,
        companyId: companyEntity?.id,
        status: 'LOG_SUCCESS',
        message: `Job ${job.id} processing COMPLETED.`,
      });
      this.logger.log(
        `Processing COMPLETED for job ${job.id}, Call ID: ${callEntity.id}`,
      );
      return {
        jobId: job.id,
        analysis,
        blobPath,
        callId: callEntity.id,
      };
    } catch (error) {
      this.logger.error(
        `Job ${job.id} FAILED during processing for Call ID: ${
          callEntity?.id || 'UNKNOWN'
        }. SID: ${callRecordingId}`,
        error.stack,
      );
      if (callEntity) {
        // Attempt to update call status to FAILED, but don't let this block job failure
        this.callRepository
          .update(callEntity.id, { callStatus: 'FAILED' })
          .catch((e) =>
            this.logger.error(
              `Failed to update call status to FAILED for Call ID ${callEntity.id}: ${e.message}`,
            ),
          );
        // Attempt to log the failure, but don't let this block job failure
        this.processingLogRepository
          .create({
            callId: callEntity.id,
            companyId: companyEntity?.id,
            status: 'LOG_ERROR',
            message: `Processing FAILED: ${error.message}`,
          })
          .catch((e) =>
            this.logger.error(
              `Failed to log JOB_FAILED for Call ID ${callEntity.id}: ${e.message}`,
            ),
          );
      }
      throw error; // Re-throw to make the job fail in BullMQ
    }
  }
}
