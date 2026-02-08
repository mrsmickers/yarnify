import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { WhisperService } from './whisper.service';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TRANSCRIPTION_QUEUE } from './constants';
import { TranscriptionProducerService } from './transcription.producer.service';
import { TranscriptionConsumer } from './transcription.consumer';
import { OpenAIModule } from '../openai/openai.module';
import { NvidiaModule } from '../nvidia/nvidia.module';
import { PromptManagementModule } from '../prompt-management/prompt-management.module';
import { CompanyInfoModule } from '../company-info/company-info.module';

@Module({
  imports: [
    ConfigModule,
    OpenAIModule,
    NvidiaModule,
    PromptManagementModule,
    CompanyInfoModule,
    BullModule.registerQueue({
      name: TRANSCRIPTION_QUEUE,
    }),
  ],
  providers: [
    TranscriptionService,
    WhisperService,
    TranscriptionProducerService,
    TranscriptionConsumer,
  ],
  exports: [TranscriptionService, WhisperService, TranscriptionProducerService],
})
export class TranscriptionModule {}
