import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
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
import { PromptManagementService } from '../prompt-management/prompt-management.service';
import { PromptVariableResolverService } from '../prompt-management/prompt-variable-resolver.service';
import { LLMConfigService } from '../prompt-management/llm-config.service';
import { CompanyInfoService } from '../company-info/company-info.service';
import { AgentAccessService } from '../agent-access/agent-access.service';
// Removed: import { Prisma } from '../../../../generated/prisma';

@Injectable()
export class CallAnalysisService {
  private readonly logger = new Logger(CallAnalysisService.name);

  constructor(
    private readonly callRepository: CallRepository,
    private readonly config: ConfigService,
    private readonly db: PrismaService,
    private readonly callProcessingProducer: CallProcessingProducerService, // Added
    private readonly promptService: PromptManagementService,
    private readonly llmConfigService: LLMConfigService,
    private readonly variableResolver: PromptVariableResolverService,
    private readonly companyInfoService: CompanyInfoService,
    private readonly agentAccessService: AgentAccessService, // For per-agent access control
  ) {}
  
  /**
   * Get the appropriate LLM provider based on configuration
   * Supports OpenAI and NVIDIA (Kimi-k2.5 via NVIDIA NIM)
   */
  private getLLMProvider(modelName: string) {
    const llmProvider = this.config.get<string>('LLM_PROVIDER', 'openai');
    
    if (llmProvider === 'nvidia') {
      const nvidiaApiKey = this.config.get<string>('NVIDIA_API_KEY');
      const nvidiaApiUrl = this.config.get<string>('NVIDIA_API_URL', 'https://integrate.api.nvidia.com/v1');
      const nvidiaModel = this.config.get<string>('NVIDIA_MODEL', 'moonshotai/kimi-k2.5');
      
      if (!nvidiaApiKey) {
        this.logger.warn('NVIDIA_API_KEY not set, falling back to OpenAI');
        return openai(modelName);
      }
      
      const nvidia = createOpenAI({
        apiKey: nvidiaApiKey,
        baseURL: nvidiaApiUrl,
      });
      
      this.logger.log(`Using NVIDIA provider with model: ${nvidiaModel}`);
      return nvidia(nvidiaModel);
    }
    
    return openai(modelName);
  }

  // Renamed from NewCallAnalysisService
  async analyzeTranscript(transcript: string): Promise<{
    analysis: CallAnalysisOutput;
    promptTemplateId?: string;
    llmConfigId?: string;
    analysisProvider: string;
    analysisModel: string;
  }> {
    // Fetch active prompt and LLM config from database
    const activePrompt = await this.promptService.findActiveByUseCase('CALL_ANALYSIS');
    const activeLLMConfig = await this.llmConfigService.findActiveByUseCase('CALL_ANALYSIS');

    // Use database values if available, otherwise fall back to hardcoded defaults
    const rawSystemPrompt = activePrompt?.content || instructions;
    const modelName = activeLLMConfig?.modelName || 'gpt-5-mini';

    // Resolve {{variable}} placeholders in the prompt
    const companyInfo = await this.companyInfoService.get();
    const companyContext = await this.companyInfoService.getForPromptInjection();
    const systemPrompt = this.variableResolver.resolve(rawSystemPrompt, {
      company_name: companyInfo?.name || 'Unknown',
      company_description: companyInfo?.description || '',
      company_industry: companyInfo?.industry || '',
      company_context: companyContext || '',
    });
    const settings = (activeLLMConfig?.settings as any) || {};
    
    const llmProvider = this.config.get<string>('LLM_PROVIDER', 'openai');
    const nvidiaModel = this.config.get<string>('NVIDIA_MODEL', 'moonshotai/kimi-k2.5');
    this.logger.log(`Analyzing transcript with provider: ${llmProvider}, model: ${modelName}, prompt: ${activePrompt?.name || 'default'}`);

    const { object } = await generateObject({
      model: this.getLLMProvider(modelName),
      schema: callAnalysisSchema,
      prompt: transcript,
      system: systemPrompt,
      temperature: settings.temperature,
      maxTokens: settings.max_tokens,
      topP: settings.top_p,
      frequencyPenalty: settings.frequency_penalty,
      presencePenalty: settings.presence_penalty,
    });

    // Determine actual provider/model used
    const nvidiaApiKey = this.config.get<string>('NVIDIA_API_KEY');
    const actualProvider = (llmProvider === 'nvidia' && nvidiaApiKey) ? 'nvidia' : 'openai';
    const actualModel = (llmProvider === 'nvidia' && nvidiaApiKey) ? nvidiaModel : modelName;

    return {
      analysis: { ...object },
      promptTemplateId: activePrompt?.id,
      llmConfigId: activeLLMConfig?.id,
      analysisProvider: actualProvider,
      analysisModel: actualModel,
    };
  }

  async extractExternalPhoneNumber(obj: CallRecordResponse['data']) {
    const companyDid = this.config.get<string>('COMPANY_DID', '01273806211');
    const extensionPrefix = this.config.get<string>('EXTENSION_STARTS_WITH') || '56360';
    const fields = [
      obj.callerid_internal,
      obj.cnumber,
      obj.dnumber,
      obj.snumber,
    ];

    for (const raw of fields) {
      if (typeof raw === 'string') {
        let candidate: string | null = null;
        const match = raw.match(/0\d{10}/); // match UK national format
        if (match) candidate = match[0];
        if (!candidate) {
          const e164 = raw.match(/\+44\d{10}/);
          if (e164) candidate = '0' + e164[0].slice(3); // convert +44 to 0
        }
        if (!candidate) {
          const stripped = raw.match(/44[1-9]\d{8,10}/);
          if (stripped) candidate = '0' + stripped[0].slice(2);
        }
        // Skip our own company DID and internal extensions — we want the *external* party
        if (candidate && candidate !== companyDid && !candidate.startsWith(extensionPrefix)) {
          return candidate;
        }
      }
    }
    return undefined;
  }

  async extractInternalPhoneNumber(obj: CallRecordResponse['data']) {
    const extensionStartsWith =
      this.config.get<string>('EXTENSION_STARTS_WITH') || '56360';

    // Log all phone number fields for attribution analysis
    this.logger.log(
      `[AgentAttribution] CDR fields — uniqueid=${obj.uniqueid} ` +
        `snumber=${obj.snumber} cnumber=${obj.cnumber} dnumber=${obj.dnumber} ` +
        `callerid_internal=${obj.callerid_internal} name=${obj.name}`,
    );

    // Priority: dnumber first (destination/final handler for transferred calls),
    // then callerid_internal, cnumber, snumber as fallbacks.
    // For transfers: snumber=initial answerer, dnumber=final handler.
    // For direct inbound: dnumber=answering agent.
    // For outbound: dnumber=external party (no extension match), falls through to snumber.
    const fields = [
      { name: 'dnumber', value: obj.dnumber }, // Destination - final handler (transferred calls)
      { name: 'callerid_internal', value: obj.callerid_internal },
      { name: 'cnumber', value: obj.cnumber }, // Called number (what was dialed)
      { name: 'snumber', value: obj.snumber }, // Source - initial answerer / outbound caller
    ];

    for (const field of fields) {
      if (typeof field.value === 'string') {
        // Try to extract any number that starts with the extension prefix
        const extensionMatch = field.value.match(
          new RegExp(`(${extensionStartsWith}\\d+)`),
        );
        if (extensionMatch) {
          // Found a potential extension
          const extracted = extensionMatch[1];
          // Ensure it's a reasonable length (5-15 digits)
          if (extracted.length >= 5 && extracted.length <= 15) {
            this.logger.log(
              `[AgentAttribution] Matched extension ${extracted} from field '${field.name}' (uniqueid=${obj.uniqueid})`,
            );
            return extracted;
          }
        }
      }
    }
    this.logger.log(
      `[AgentAttribution] No internal extension found for uniqueid=${obj.uniqueid}`,
    );
    return undefined;
  }

  /**
   * Determine call direction from CDR fields.
   * - INBOUND: snumber is external (UK phone number), cnumber/dnumber is internal extension or company DID
   * - OUTBOUND: snumber is internal extension, cnumber/dnumber is external phone
   * - INTERNAL: both snumber and cnumber/dnumber are internal extensions (e.g. transfers, voicemail)
   * - UNKNOWN: can't determine
   */
  determineCallDirection(obj: CallRecordResponse['data']): 'INBOUND' | 'OUTBOUND' | 'INTERNAL' | 'UNKNOWN' {
    const extensionPrefix = this.config.get<string>('EXTENSION_STARTS_WITH') || '56360';
    const companyDid = this.config.get<string>('COMPANY_DID', '01273806211');
    
    const isExtension = (val?: string) =>
      typeof val === 'string' && val.startsWith(extensionPrefix);
    // Match any UK phone number: mobiles (07), landlines (01/02), or E.164 (+44)
    const isPhoneNumber = (val?: string) =>
      typeof val === 'string' && (
        /^0[1-9]\d{8,10}$/.test(val) ||
        /^\+44\d{10}$/.test(val) ||
        /^44[1-9]\d{8,10}$/.test(val)
      );
    const isCompanyDid = (val?: string) =>
      typeof val === 'string' && val === companyDid;

    const snumberIsInternal = isExtension(obj.snumber);
    const snumberIsPhone = isPhoneNumber(obj.snumber);
    const cnumberIsInternal = isExtension(obj.cnumber);
    const cnumberIsPhone = isPhoneNumber(obj.cnumber);

    // Check for special codes (e.g. *78 = voicemail)
    const isSpecialCode = (val?: string) =>
      typeof val === 'string' && val.startsWith('*');

    // OUTBOUND: agent (internal extension) calls an external phone number
    if (snumberIsInternal && cnumberIsPhone && !isCompanyDid(obj.cnumber)) {
      return 'OUTBOUND';
    }
    // INBOUND: external phone calls in, reaches an extension or company DID
    if (snumberIsPhone && !snumberIsInternal) {
      if (cnumberIsInternal || isExtension(obj.dnumber) || isCompanyDid(obj.cnumber)) {
        return 'INBOUND';
      }
    }
    // INTERNAL: extension to extension, or extension to special code (*78 voicemail etc)
    if (snumberIsInternal && (cnumberIsInternal || isSpecialCode(obj.cnumber))) {
      return 'INTERNAL';
    }

    this.logger.log(
      `[CallDirection] Could not determine direction for uniqueid=${obj.uniqueid} ` +
        `(snumber=${obj.snumber}, cnumber=${obj.cnumber})`,
    );
    return 'UNKNOWN';
  }

  /**
   * LLM-based agent identification fallback.
   * When CDR fields don't contain an internal extension, we send the transcript
   * to the LLM with the known agent list and ask it to identify the primary handler.
   */
  async identifyAgentFromTranscript(
    transcript: string,
    callSid: string,
  ): Promise<{ agentName: string; confidence: 'high' | 'medium' | 'low'; reasoning: string } | null> {
    try {
      // Build agent list from DB
      const agents = await this.db.agent.findMany({
        select: { name: true, extension: true },
        orderBy: { name: 'asc' },
      });

      if (agents.length === 0) {
        this.logger.warn('[AgentAttribution/LLM] No agents in database, cannot identify speaker');
        return null;
      }

      const agentListStr = agents
        .map((a) => `- ${a.name} (ext: ${a.extension})`)
        .join('\n');

      // Use first 3000 chars of transcript — enough for speaker identification
      const truncatedTranscript = transcript.length > 3000
        ? transcript.substring(0, 3000) + '\n... [transcript truncated]'
        : transcript;

      const speakerIdSchema = z.object({
        agentName: z.string().describe('The name of the staff member who is the primary handler in this call. Must exactly match one of the names from the agent list, or "NONE" if no agent is identifiable.'),
        confidence: z.enum(['high', 'medium', 'low']).describe('How confident you are in the identification. high = agent clearly named/identified, medium = likely but inferred, low = uncertain'),
        reasoning: z.string().describe('Brief explanation of how you identified the agent (e.g. "Agent introduces themselves as Joel" or "No live agent present - voicemail only")'),
      });

      // Try to load prompt from DB, fall back to hardcoded default
      const activePrompt = await this.promptService.findActiveByUseCase('AGENT_IDENTIFICATION');
      const companyInfo = await this.companyInfoService.get();
      const companyName = companyInfo?.name || 'Ingenio Technologies';

      const defaultPrompt = `You are an agent identification system for {{company_name}}, an IT managed services provider.

Your task: identify which {{company_name}} staff member is the PRIMARY HANDLER in this call transcript.

Known {{company_name}} staff:
${agentListStr}

Rules:
1. Look for the agent who HANDLES the customer's issue — not reception/transfer agents
2. Agents often introduce themselves by name ("Hi, it's Joel speaking")
3. Speaker labels like **Joel:** or **Freddie:** directly indicate the speaker
4. If the call is voicemail, IVR, or automated with no live agent, return agentName="NONE"
5. If a call is transferred, the primary handler is the person who deals with the customer's actual issue
6. The agentName must EXACTLY match one of the names from the agent list above, or be "NONE"`;

      const rawPrompt = activePrompt?.content || defaultPrompt;
      const systemPrompt = this.variableResolver.resolve(rawPrompt, {
        company_name: companyName,
        agent_list: agents.map((a) => a.name).join(', '),
      });

      const { object } = await generateObject({
        model: this.getLLMProvider('gpt-5-mini'),
        schema: speakerIdSchema,
        prompt: `Identify the primary Ingenio agent in this call transcript:\n\n${truncatedTranscript}`,
        system: systemPrompt,
        temperature: 0.1, // Low temp for deterministic identification
      });

      this.logger.log(
        `[AgentAttribution/LLM] Result for ${callSid}: agent="${object.agentName}" confidence=${object.confidence} reason="${object.reasoning}"`,
      );

      if (object.agentName === 'NONE') {
        return null;
      }

      // Verify the name matches a real agent
      const matchedAgent = agents.find(
        (a) => a.name.toLowerCase() === object.agentName.toLowerCase(),
      );

      if (!matchedAgent) {
        this.logger.warn(
          `[AgentAttribution/LLM] LLM returned "${object.agentName}" but no matching agent in DB for ${callSid}`,
        );
        return null;
      }

      return {
        agentName: matchedAgent.name,
        confidence: object.confidence,
        reasoning: object.reasoning,
      };
    } catch (error) {
      this.logger.error(
        `[AgentAttribution/LLM] Failed for ${callSid}: ${error.message}`,
        error.stack,
      );
      return null; // Non-fatal — call still processes without attribution
    }
  }

  /**
   * User context for agent-based call scoping.
   * - admin: sees all calls
   * - others: see calls for agents they have access to (own + granted)
   */
  async getCalls(
    query: GetCallsQueryDto,
    userContext?: { role: string; userId: string; entraUserId?: string; department?: string | null },
  ): Promise<PaginatedCallsResponseDto> {
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

    // Apply agent-based access control if userContext is provided
    if (userContext && userContext.role !== 'admin') {
      // Get all agent IDs this user has access to
      const entraUserId = userContext.entraUserId;
      if (entraUserId) {
        const accessibleAgentIds = await this.agentAccessService.getAccessibleAgentIds(entraUserId);
        
        if (accessibleAgentIds.length === 0) {
          // User has no agent access — return empty result
          return {
            data: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
            metrics: {
              totalPositiveSentiment: 0,
              totalNegativeSentiment: 0,
              totalNeutralSentiment: 0,
              averageConfidence: 0,
            },
          };
        }
        
        // Filter to only accessible agents
        where.agentsId = { in: accessibleAgentIds };
      } else {
        // Fallback to OID-based lookup for backward compatibility
        where.Agents = {
          entraUser: {
            oid: userContext.userId,
          },
        };
      }
    }
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
    
    // Exclude queue and api legs from main list:
    // - queue: internal routing steps (IVR/queue to agent)
    // - api: duplicate "inbound perspective" of outbound calls (same conversation recorded twice)
    // These are shown in the call detail timeline view for grouped/transferred calls
    where.sourceType = { notIn: ['queue', 'api'] };
    
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
        Agents: true, // Include primary agent
        TransferredToAgent: true, // Include transferred-to agent
      },
    });

    const total = await this.callRepository.count({ where });

    // Get group sizes for transferred calls (excluding queue legs - those are internal routing, not real transfers)
    const groupIds = calls
      .map((c: any) => c.callGroupId)
      .filter((id): id is string => !!id);
    
    // @ts-ignore - new fields not in Prisma types yet
    const groupCounts: Array<{ callGroupId: string; _count: number }> = groupIds.length > 0
      ? await (this.db.call.groupBy as any)({
          by: ['callGroupId'],
          where: { 
            callGroupId: { in: groupIds },
            sourceType: { not: 'queue' }, // Don't count queue legs as transfers
          },
          _count: true,
        })
      : [];
    const groupSizeMap = new Map(groupCounts.map((g: any) => [g.callGroupId, g._count]));

    const callResponseDtos: CallResponseDto[] = calls.map((call: any) => {
      const groupSize = call.callGroupId ? (groupSizeMap.get(call.callGroupId) || 1) : 1;
      return {
        id: call.id,
        callSid: call.callSid,
        companyId: call.companyId,
        callDirection: call.callDirection,
        externalPhoneNumber: call.externalPhoneNumber,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore // company is included
        companyName: call.company?.name, // Optional: include company name
        startTime: call.startTime,
        endTime: call.endTime,
        duration: call.duration,
        transcriptUrl: call.transcriptUrl, // Added transcriptUrl
        callStatus: call.callStatus, // Prisma model uses string for callStatus
        agentName: call.Agents?.name || null, // Optional: include agent name
        analysis: call.analysis?.data, // Assuming analysis data is in 'data' field
        processingMetadata: call.processingMetadata,
        createdAt: call.createdAt,
        updatedAt: call.updatedAt,
        // Grouping fields
        callGroupId: call.callGroupId,
        callLegOrder: call.callLegOrder,
        groupSize,
        isTransferred: !!call.callGroupId && groupSize > 1,
        sourceType: call.sourceType,
        destinationType: call.destinationType,
        // Transfer detection fields
        transferredToAgentName: call.TransferredToAgent?.name || null,
        transferredToAgentId: call.transferredToAgentId || null,
        transferNote: call.transferNote || null,
        transferDetectedAt: call.transferDetectedAt || null,
      };
    });

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

    // Get related calls if this is part of a group
    let relatedCalls: CallResponseDto[] | undefined;
    // @ts-ignore - callGroupId exists on extended call type
    if ((call as any).callGroupId) {
      // @ts-ignore - new fields not in Prisma types yet
      const groupCalls = await this.db.call.findMany({
        where: { callGroupId: (call as any).callGroupId, id: { not: call.id } } as any,
        include: { Agents: true, analysis: true, company: true },
        orderBy: { callLegOrder: 'asc' } as any,
      });
      relatedCalls = groupCalls.map((c: any) => ({
        id: c.id,
        callSid: c.callSid,
        companyId: c.companyId,
        callDirection: c.callDirection,
        externalPhoneNumber: c.externalPhoneNumber,
        companyName: c.company?.name,
        startTime: c.startTime,
        endTime: c.endTime,
        duration: c.duration,
        transcriptUrl: c.transcriptUrl,
        callStatus: c.callStatus,
        analysis: c.analysis?.data,
        agentName: c.Agents?.name || null,
        callGroupId: c.callGroupId,
        callLegOrder: c.callLegOrder,
        sourceType: c.sourceType,
        destinationType: c.destinationType,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    }

    // Count group size (excluding queue legs - those are internal routing, not real transfers)
    const groupSize = (call as any).callGroupId
      // @ts-ignore - new fields not in Prisma types yet
      ? await this.db.call.count({ where: { callGroupId: (call as any).callGroupId, sourceType: { not: 'queue' } } as any })
      : 1;

    // Map to CallResponseDto, similar to getCalls
    return {
      id: call.id,
      callSid: call.callSid,
      companyId: call.companyId,
      callDirection: call.callDirection,
      externalPhoneNumber: call.externalPhoneNumber,
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
      processingMetadata: call.processingMetadata,
      createdAt: call.createdAt,
      updatedAt: call.updatedAt,
      // Grouping fields
      // @ts-ignore
      callGroupId: call.callGroupId,
      // @ts-ignore
      callLegOrder: call.callLegOrder,
      groupSize,
      // @ts-ignore
      isTransferred: !!call.callGroupId && groupSize > 1,
      relatedCalls,
      // @ts-ignore
      sourceType: call.sourceType,
      // @ts-ignore
      destinationType: call.destinationType,
      // Transfer detection fields
      // @ts-ignore
      transferredToAgentName: call.TransferredToAgent?.name || null,
      // @ts-ignore
      transferredToAgentId: call.transferredToAgentId || null,
      // @ts-ignore
      transferNote: call.transferNote || null,
      // @ts-ignore
      transferDetectedAt: call.transferDetectedAt || null,
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

  /**
   * Get calls for the currently logged-in user by finding their linked agent.
   * Returns paginated calls filtered to the user's agent, or an empty result
   * with a message if no agent is linked.
   */
  async getMyCalls(
    userOid: string,
    query: GetCallsQueryDto,
  ): Promise<PaginatedCallsResponseDto & { agentLinked: boolean; agentName?: string }> {
    // Find the EntraUser by oid
    const entraUser = await this.db.entraUser.findUnique({
      where: { oid: userOid },
    });

    if (!entraUser) {
      return {
        data: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
        totalPages: 0,
        metrics: {
          totalPositiveSentiment: 0,
          totalNegativeSentiment: 0,
          totalNeutralSentiment: 0,
          averageConfidence: 0,
        },
        agentLinked: false,
      };
    }

    // Find the linked agent
    const agent = await this.db.agent.findFirst({
      where: { entraUserId: entraUser.id },
    });

    if (!agent) {
      return {
        data: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
        totalPages: 0,
        metrics: {
          totalPositiveSentiment: 0,
          totalNegativeSentiment: 0,
          totalNeutralSentiment: 0,
          averageConfidence: 0,
        },
        agentLinked: false,
      };
    }

    // Find calls where this agent is:
    // 1. Directly assigned as primary agent (agentsId)
    // 2. The transferred-to agent (transferredToAgentId) 
    // 3. Part of a grouped call where they handled one leg
    
    // Step 1: Get group IDs where this agent has a call (either as primary or transferred-to)
    // @ts-ignore - new fields not in Prisma types yet
    const agentCallGroups: Array<{ callGroupId: string | null }> = await this.db.call.findMany({
      where: {
        OR: [
          { agentsId: agent.id },
          { transferredToAgentId: agent.id },
        ],
        callGroupId: { not: null },
      } as any,
      select: { callGroupId: true } as any,
      distinct: ['callGroupId'] as any,
    });
    const agentGroupIds = agentCallGroups
      .map((c: any) => c.callGroupId)
      .filter((id): id is string => id !== null);

    // Step 2: Build query that includes direct calls, transferred calls, AND calls in shared groups
    const myQuery: GetCallsQueryDto = {
      ...query,
      // We'll handle the agentId filter specially below
    };

    // Custom query with OR logic for agent attribution
    // Include calls where agent is primary, transferred-to, or in a shared group
    const result = await this.getCallsWithGroupAccess(myQuery, agent.id, agentGroupIds);
    return {
      ...result,
      agentLinked: true,
      agentName: agent.name,
    };
  }

  /**
   * Get calls with access through both direct attribution AND group membership.
   * Used by getMyCalls to show all calls an agent is involved in.
   */
  private async getCallsWithGroupAccess(
    query: GetCallsQueryDto,
    agentId: string,
    groupIds: string[],
  ): Promise<PaginatedCallsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause: direct agent assignment, transferred-to, OR in shared group
    const orConditions: any[] = [
      { agentsId: agentId },
      { transferredToAgentId: agentId },
    ];
    if (groupIds.length > 0) {
      orConditions.push({ callGroupId: { in: groupIds } });
    }
    const where: any = {
      OR: orConditions,
    };

    // Apply other filters
    if (query.startDate) where.startTime = { ...(where.startTime || {}), gte: query.startDate };
    if (query.endDate) where.startTime = { ...(where.startTime || {}), lte: query.endDate };
    if (query.companyId) where.companyId = query.companyId;
    if (query.status) where.callStatus = query.status;
    if (query.sentiment) {
      where.analysis = {
        data: {
          path: ['sentiment'],
          equals: query.sentiment,
        },
      };
    }

    const [calls, total] = await Promise.all([
      this.db.call.findMany({
        where,
        include: {
          company: true,
          analysis: true,
          Agents: true,
          TransferredToAgent: true,
        },
        skip,
        take: limit,
        orderBy: { startTime: 'desc' },
      }),
      this.db.call.count({ where }),
    ]);

    // Get group sizes for transferred calls (excluding queue legs - those are internal routing, not real transfers)
    // @ts-ignore - new fields not in Prisma types yet
    const groupCounts: Array<{ callGroupId: string; _count: number }> = await (this.db.call.groupBy as any)({
      by: ['callGroupId'],
      where: { 
        callGroupId: { in: calls.map((c: any) => c.callGroupId).filter((id: any): id is string => !!id) },
        sourceType: { not: 'queue' }, // Don't count queue legs as transfers
      },
      _count: true,
    });
    const groupSizeMap = new Map(groupCounts.map((g: any) => [g.callGroupId, g._count]));

    // Calculate metrics (simplified)
    const analysisData = calls
      .filter((c: any) => c.analysis?.data)
      .map((c: any) => c.analysis.data as Record<string, any>);

    const metrics = {
      totalPositiveSentiment: analysisData.filter((a) => a.sentiment === 'Positive').length,
      totalNegativeSentiment: analysisData.filter((a) => a.sentiment === 'Negative').length,
      totalNeutralSentiment: analysisData.filter((a) => a.sentiment === 'Neutral').length,
      averageConfidence: analysisData.length > 0
        ? analysisData.reduce((sum, a) => sum + (a.ai_confidence || 0), 0) / analysisData.length
        : 0,
    };

    return {
      data: calls.map((call: any) => {
        const groupSize = call.callGroupId ? (groupSizeMap.get(call.callGroupId) || 1) : 1;
        return {
          id: call.id,
          callSid: call.callSid,
          companyId: call.companyId,
          companyName: call.company?.name,
          callDirection: call.callDirection,
          externalPhoneNumber: call.externalPhoneNumber,
          startTime: call.startTime,
          endTime: call.endTime,
          duration: call.duration,
          transcriptUrl: call.transcriptUrl,
          callStatus: call.callStatus,
          analysis: call.analysis?.data,
          agentName: call.Agents?.name || null,
          processingMetadata: call.processingMetadata,
          createdAt: call.createdAt,
          updatedAt: call.updatedAt,
          callGroupId: call.callGroupId,
          callLegOrder: call.callLegOrder,
          groupSize,
          isTransferred: !!call.callGroupId && groupSize > 1,
          sourceType: call.sourceType,
          destinationType: call.destinationType,
          // Transfer detection fields
          transferredToAgentName: call.TransferredToAgent?.name || null,
          transferredToAgentId: call.transferredToAgentId || null,
          transferNote: call.transferNote || null,
          transferDetectedAt: call.transferDetectedAt || null,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      metrics,
    };
  }

  /**
   * Look up a user's role, department, and ID by their Entra OID.
   * Used by the controller to build user context for agent-based call scoping.
   */
  async getUserContext(oid: string): Promise<{ id: string; role: string; department: string | null; entraUserId: string } | null> {
    const user = await this.db.entraUser.findUnique({
      where: { oid },
      select: { id: true, role: true, department: true },
    });
    return user ? { id: user.id, role: user.role, department: user.department, entraUserId: user.id } : null;
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

  /**
   * Delete all calls within a date range (inclusive).
   * Also deletes related records (FK constraints).
   */
  async bulkDeleteByDateRange(dateFrom: string, dateTo: string): Promise<number> {
    const startDate = new Date(dateFrom);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);

    // Find call IDs in range
    const calls = await this.db.call.findMany({
      where: {
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { id: true },
    });

    if (calls.length === 0) {
      return 0;
    }

    const callIds = calls.map((c) => c.id);

    // Delete related records first (FK constraints)
    await this.db.callAnalysis.deleteMany({
      where: { callId: { in: callIds } },
    });

    await this.db.processingLog.deleteMany({
      where: { callId: { in: callIds } },
    });

    await this.db.sentimentAlert.deleteMany({
      where: { callId: { in: callIds } },
    });

    // Delete calls
    const result = await this.db.call.deleteMany({
      where: { id: { in: callIds } },
    });

    return result.count;
  }
}
