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
  ],
  exports: [
    CallAnalysisService,
    CallProcessingProducerService,
    CallRepository,
    CompanyRepository,
    CallAnalysisRepository,
    ProcessingLogRepository,
  ],
})
export class CallAnalysisModule {}
