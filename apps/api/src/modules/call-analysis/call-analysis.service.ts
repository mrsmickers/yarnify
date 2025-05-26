import { Injectable } from '@nestjs/common';
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
} from './dto/get-calls.dto';
import { Prisma } from '@db'; // Use @db alias
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CallAnalysisService {
  constructor(
    private readonly callRepository: CallRepository,
    private readonly config: ConfigService,
  ) {}
  // Renamed from NewCallAnalysisService
  async analyzeTranscript(transcript: string): Promise<CallAnalysisOutput> {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: callAnalysisSchema,
      prompt: transcript,
      system: instructions,
    });
    return object;
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
    console.log('No internal phone number found in call record:', obj);
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
      if (typeof where.endTime !== 'object' || where.endTime === null) {
        where.endTime = {};
      }
      (where.endTime as Prisma.DateTimeFilter).lte = endDate;
    }
    if (companyId) {
      where.companyId = companyId;
    }
    if (status) {
      where.callStatus = status;
    }
    if (searchTerm) {
      where.OR = [
        { callSid: { contains: searchTerm, mode: 'insensitive' } },
        // Add other fields to search if necessary, e.g., company name if you join and search
        // { company: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    const calls = await this.callRepository.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        startTime: 'desc', // Default sort order
      },
      include: {
        analysis: true, // Include related call analysis data
        company: true, // Include company data
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
      callStatus: call.callStatus, // Prisma model uses string for callStatus
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // analysis is included
      analysis: call.analysis?.data, // Assuming analysis data is in 'data' field
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
    }));

    return {
      data: callResponseDtos,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
      callStatus: call.callStatus,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // analysis is included via repository
      analysis: call.analysis?.data,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
    };
  }
}
