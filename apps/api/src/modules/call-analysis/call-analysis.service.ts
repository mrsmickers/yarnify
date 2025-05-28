import { Injectable, NotFoundException } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { instructions, callAnalysisSchema, CallAnalysisOutput } from './prompt';
import { CallRecordResponse } from '../voip/dto/call-recording.dto';
// import { Company } from '../connectwise-manage/types'; // Company type from Prisma might be more appropriate here
import { CallRepository } from './repositories/call.repository';
import {
  GetCallsQueryDto,
  PaginatedCallsResponseDto,
  CallResponseDto,
  CompanyListItemDto, // Added
  AgentListItemDto, // Added
} from './dto/get-calls.dto';
import { Prisma } from '@db'; // Use @db alias - This is the correct one
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CallProcessingProducerService } from './call-processing.producer.service';
// Removed: import { Prisma } from '../../../../generated/prisma';

@Injectable()
export class CallAnalysisService {
  constructor(
    private readonly callRepository: CallRepository,
    private readonly config: ConfigService,
    private readonly db: PrismaService,
    private readonly callProcessingProducer: CallProcessingProducerService, // Added
  ) {}
  // Renamed from NewCallAnalysisService
  async analyzeTranscript(transcript: string): Promise<CallAnalysisOutput> {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: callAnalysisSchema,
      prompt: transcript,
      system: instructions,
    });

    return {
      ...object,
    };
  }

  async extractExternalPhoneNumber(obj: CallRecordResponse['data']) {
    const fields = [
      obj.callerid_internal,
      obj.cnumber,
      obj.dnumber,
      obj.snumber,
    ];

    for (const raw of fields) {
      if (typeof raw === 'string') {
        const match = raw.match(/0\d{10}/); // match UK national format
        if (match) return match[0];
        const e164 = raw.match(/\+44\d{10}/);
        if (e164) return '0' + e164[0].slice(3); // convert +44 to 0
        const stripped = raw.match(/447\d{9}/);
        if (stripped) return '0' + stripped[0].slice(2);
      }
    }
    return undefined;
  }

  async extractInternalPhoneNumber(obj: CallRecordResponse['data']) {
    const extensionStartsWith =
      this.config.get<string>('EXTENSION_STARTS_WITH') || '0';

    const fields = [
      obj.callerid_internal,
      obj.cnumber,
      obj.dnumber,
      obj.snumber,
    ];
    for (const raw of fields) {
      if (typeof raw === 'string') {
        // Check for extension first
        const extensionMatch = raw.match(
          new RegExp(`${extensionStartsWith}\\d+`),
        );
        if (extensionMatch) return extensionMatch[0];
      }
    }
    return undefined;
  }

  async getCalls(query: GetCallsQueryDto): Promise<PaginatedCallsResponseDto> {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      companyId,
      status,
      searchTerm,
      agentId, // Added agentId
      sentiment, // Added sentiment
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CallWhereInput = {}; // Use Prisma.CallWhereInput
    if (startDate) {
      if (typeof where.startTime !== 'object' || where.startTime === null) {
        where.startTime = {};
      }
      (where.startTime as Prisma.DateTimeFilter).gte = startDate;
    }
    if (endDate) {
      // Corrected to apply to startTime for end of day
      if (typeof where.startTime !== 'object' || where.startTime === null) {
        where.startTime = {};
      }
      // If filtering for a whole day, endDate should be the start of the next day
      // For simplicity here, assuming endDate is precise or handled client-side for day range
      (where.startTime as Prisma.DateTimeFilter).lte = endDate;
    }
    if (companyId) {
      where.companyId = companyId;
    }
    if (agentId) {
      where.agentsId = agentId; // Corrected based on TS error suggestion
    }
    if (sentiment) {
      // Filter by sentiment in the related CallAnalysis record's 'data' JSON field
      where.analysis = {
        is: {
          // 'data' is the JSON field on the CallAnalysis model
          // We apply JsonFilter conditions to it.
          data: {
            // Path to the 'sentiment' key within the 'data' JSON object
            path: ['sentiment'],
            // The value to match for the 'sentiment' key
            equals: sentiment,
          } as Prisma.JsonFilter, // Type assertion for JsonFilter
        },
      };
    }
    if (status) {
      where.callStatus = status;
    } else {
      where.callStatus = {
        notIn: ['INTERNAL_CALL_SKIPPED'], // Default statuses to include
      };
    }
    if (searchTerm) {
      where.OR = [
        { callSid: { contains: searchTerm, mode: 'insensitive' } },
        // Add other fields to search if necessary, e.g., company name if you join and search
        // { company: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const calls = await this.db.call.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        startTime: 'desc', // Default sort order
      },
      include: {
        analysis: true, // Include related call analysis data
        company: true, // Include company data
        Agents: true, // Include related agents if necessary
      },
    });

    const total = await this.callRepository.count({ where });

    const callResponseDtos: CallResponseDto[] = calls.map((call) => ({
      id: call.id,
      callSid: call.callSid,
      companyId: call.companyId,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // company is included
      companyName: call.company?.name, // Optional: include company name
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      transcriptUrl: call.transcriptUrl, // Added transcriptUrl
      callStatus: call.callStatus, // Prisma model uses string for callStatus
      agentName: call.Agents?.name || null, // Optional: include agent name{
      analysis: call.analysis?.data, // Assuming analysis data is in 'data' field
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
    }));

    // Calculate metrics across all calls (not just current page)
    const allCalls = await this.db.call.findMany({
      where,
      include: {
        analysis: true,
      },
    });

    let totalPositiveSentiment = 0;
    let totalNegativeSentiment = 0;
    let totalNeutralSentiment = 0;
    let totalConfidenceScore = 0;
    let callsWithConfidence = 0;

    allCalls.forEach((call) => {
      const sentiment = (
        call.analysis?.data?.sentiment as string
      )?.toLowerCase();
      if (sentiment === 'positive') totalPositiveSentiment++;
      else if (sentiment === 'negative') totalNegativeSentiment++;
      else if (sentiment === 'neutral') totalNeutralSentiment++;

      const confidence = call.analysis?.data?.confidence_level as string;
      if (confidence) {
        switch (confidence.toLowerCase()) {
          case 'high':
            totalConfidenceScore += 100;
            break;
          case 'medium':
            totalConfidenceScore += 50;
            break;
          case 'low':
            totalConfidenceScore += 25;
            break;
        }
        callsWithConfidence++;
      }
    });

    const avgConfidence =
      callsWithConfidence > 0 ? totalConfidenceScore / callsWithConfidence : 0;

    return {
      data: callResponseDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      metrics: {
        totalPositiveSentiment,
        totalNegativeSentiment,
        totalNeutralSentiment,
        averageConfidence: Math.round(avgConfidence),
      },
    };
  }

  async getCallById(id: string): Promise<CallResponseDto | null> {
    const call = await this.callRepository.findById(id);
    if (!call) {
      return null;
    }

    // Map to CallResponseDto, similar to getCalls
    return {
      id: call.id,
      callSid: call.callSid,
      companyId: call.companyId,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // company is included via repository
      companyName: call.company?.name,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      transcriptUrl: call.transcriptUrl, // Added transcriptUrl
      callStatus: call.callStatus,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // analysis is included via repository
      analysis: call.analysis?.data,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // Agents is included via repository (after update)
      agentName: call.Agents?.name || null,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
    };
  }

  async reprocessCall(id: string): Promise<{ message: string }> {
    const call = await this.callRepository.findById(id);

    if (!call) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }

    if (!call.callSid) {
      throw new NotFoundException(
        `Call with ID ${id} does not have a callSid, cannot reprocess.`,
      );
    }

    // Update call status to PENDING and disconnect old analysis
    // Also, if there's an existing CallAnalysis record, we might want to delete it or mark it as outdated.
    // For now, just disconnecting by setting callAnalysisId to null.
    // The consumer will create a new one.
    await this.db.call.update({
      where: { id },
      data: {
        callStatus: 'PENDING', // Use string literal as CallStatus is not an enum in Prisma schema
        callAnalysisId: null, // Disconnect the previous analysis
        // Optionally, explicitly disconnect the relation if Prisma version requires it
        // analysis: {
        //  disconnect: call.callAnalysisId ? true : undefined
        // }
      },
    });

    // If a CallAnalysis record exists for this call, delete it to ensure a fresh reprocessing.
    // This step is crucial if the consumer doesn't automatically handle overwriting or creating new analysis records cleanly.
    if (call.callAnalysisId) {
      await this.db.callAnalysis
        .delete({ where: { id: call.callAnalysisId } })
        .catch((err) => {
          // Log error if deletion fails, but proceed with reprocessing
          console.error(
            `Failed to delete old analysis ${call.callAnalysisId} for call ${id}:`,
            err,
          );
        });
    }

    // Add to processing queue
    await this.callProcessingProducer.addCallToProcessingQueue({
      callRecordingId: call.callSid,
    });

    return { message: `Call with ID ${id} has been queued for reprocessing.` };
  }

  async getCompanyList(): Promise<CompanyListItemDto[]> {
    const companies = await this.db.company.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return companies.map((company) => ({
      id: company.id,
      name: company.name || 'Unnamed Company', // Handle cases where name might be null
    }));
  }

  async getAgentList(): Promise<AgentListItemDto[]> {
    // Assuming your agent model is named 'Agents' as seen in 'include: { Agents: true }'
    // and has 'id' and 'name' fields. Adjust if your model is different.
    const agents = await this.db.agent.findMany({
      // Corrected from 'agents' to 'agent'
      // Changed from 'agent' to 'agents'
      select: {
        id: true,
        name: true,
      },
      // Removed where clause for name, assuming names are generally non-null for selectable agents
      orderBy: {
        name: 'asc',
      },
    });
    return agents.map((agent) => ({
      id: agent.id,
      name: agent.name as string, // Assert name is string as we filtered out nulls
    }));
  }
}
