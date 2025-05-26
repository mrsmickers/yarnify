import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { CallRecordingService } from './call-recording.service';
import { VoipController } from './voip.controller';
import { TranscriptionModule } from '../transcription/transcription.module';
import { StorageModule } from '../storage/storage.module';
import { CallAnalysisModule } from '../call-analysis/call-analysis.module';
import { CALL_RECORDING_SYNC_QUEUE } from './constants';
import { CallRecordingSyncProducerService } from './call-recording-sync.producer.service';
import { CallRecordingSyncConsumer } from './call-recording-sync.consumer';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    TranscriptionModule,
    StorageModule,
    forwardRef(() => CallAnalysisModule),
    BullModule.registerQueue({
      name: CALL_RECORDING_SYNC_QUEUE,
    }),
  ],
  controllers: [VoipController],
  providers: [
    CallRecordingService,
    CallRecordingSyncProducerService,
    CallRecordingSyncConsumer,
  ],
  exports: [CallRecordingService],
})
export class VoipModule {}
