import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CallAnalysisService } from './call-analysis.service';
import { CallProcessingProducerService } from './call-processing.producer.service';
import { CallProcessingConsumer } from './call-processing.consumer';
import { CALL_PROCESSING_QUEUE } from '../transcription/constants';
import { TranscriptionModule } from '../transcription/transcription.module';
import { StorageModule } from '../storage/storage.module';
import { PrismaModule } from '../prisma/prisma.module';
import { VoipModule } from '../voip/voip.module';
import { ConnectwiseManageModule } from '../connectwise-manage/connectwise-manage.module';
import { CallRepository } from './repositories/call.repository';
import { CompanyRepository } from './repositories/company.repository';
import { CallAnalysisRepository } from './repositories/call-analysis.repository';
import { ProcessingLogRepository } from './repositories/processing-log.repository';
import { CallAnalysisController } from './call-analysis.controller';
import { AgentRepository } from './repositories/agent.repository';
import { EmbeddingModule } from '../embedding/embedding.module';
import { TextChunkingModule } from '../text-chunking/text-chunking.module';
import { CallTranscriptEmbeddingRepository } from './repositories/call-transcript-embedding.repository';
import { PromptManagementModule } from '../prompt-management/prompt-management.module';
import { CompanyInfoModule } from '../company-info/company-info.module';
import { TrainingRulesModule } from '../training-rules/training-rules.module';
import { SentimentAlertsModule } from '../sentiment-alerts/sentiment-alerts.module';
import { AgentAccessModule } from '../agent-access/agent-access.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CALL_PROCESSING_QUEUE,
    }),
    TranscriptionModule, // For TranscriptionService
    StorageModule, // For StorageService
    PrismaModule, // For PrismaService
    forwardRef(() => VoipModule), // For CallRecordingService
    ConnectwiseManageModule,
    EmbeddingModule, // For EmbeddingService
    TextChunkingModule, // For TextChunkingService
    PromptManagementModule, // For PromptManagementService and LLMConfigService
    CompanyInfoModule, // For CompanyInfoService (prompt injection)
    TrainingRulesModule, // For TrainingRulesService (training rules prompt injection)
    SentimentAlertsModule, // For SentimentAlertsService (post-analysis sentiment alerting)
    AgentAccessModule, // For per-agent access control
  ],
  controllers: [CallAnalysisController], // Added controller
  providers: [
    CallAnalysisService,
    CallProcessingProducerService,
    CallProcessingConsumer,
    CallRepository,
    CompanyRepository,
    CallAnalysisRepository,
    ProcessingLogRepository,
    AgentRepository,
    CallTranscriptEmbeddingRepository,
  ],
  exports: [
    CallAnalysisService,
    CallProcessingProducerService,
    CallRepository,
    CompanyRepository,
    CallAnalysisRepository,
    ProcessingLogRepository,
    AgentRepository,
    CallTranscriptEmbeddingRepository,
  ],
})
export class CallAnalysisModule {}
