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
import { Prisma, Call, Company, CallAnalysis } from '../../../generated/prisma';
import { dayjs } from '../../lib/dayjs';
import internal from 'stream';
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
        });
      } else {
        callEntity = await this.callRepository.create({
          callSid: callRecordingId,
          // startDate from job data
          startTime,
          endTime,
          duration,
          callStatus: 'PROCESSING',
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
      const recordingData = recordingResponse.data;
      const audioBase64 = recordingData.data;
      const mimeType = recordingData.mimetype || 'audio/mpeg';

      // 2. Upload fetched audio to blob storage
      const blobFileName = `call-recordings/${callRecordingId}.${
        mimeType.split('/')[1] || 'mp3'
      }`;
      const audioBufferForUpload = Buffer.from(audioBase64, 'base64');
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
      const transcript = await this.transcriptionService.transcribeAudio(
        audioBase64,
        mimeType,
      );
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

      const internalPhoneNumber =
        await this.callAnalysisService.extractInternalPhoneNumber(
          recordingData,
        );

      let internalExtensionName;
      if (internalPhoneNumber) {
        internalExtensionName = await this.callRecordingService.getExtension(
          internalPhoneNumber,
        );
        console.log(
          `Extracted internal extension:`,
          internalExtensionName.data.callername_internal,
        );
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
      Find the agent name from snumber_display or dnumber_display if available.\n
      agent_name: ${internalExtensionName}
      Transcript: ${transcript}`;

      const analysisResult = await this.callAnalysisService.analyzeTranscript(
        promptTranscript,
      ); // Existing service method
      await this.processingLogRepository.create({
        callId: callEntity.id,
        companyId: companyEntity?.id,
        status: 'LOG_INFO',
        message: 'Transcript analysis successful.',
      });

      // 6. Save analysis result
      const callAnalysisEntity = await this.callAnalysisRepository.create({
        callId: callEntity.id,
        companyId: companyEntity?.id,
        data: analysisResult,
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

      await this.callRepository.update(callEntity.id, {
        callStatus: 'COMPLETED',
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
        analysis: analysisResult,
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
