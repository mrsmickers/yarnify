import { Module } from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TRANSCRIPTION_QUEUE } from './constants';
import { TranscriptionProducerService } from './transcription.producer.service';
import { TranscriptionConsumer } from './transcription.consumer';
import { OpenAIModule } from '../openai/openai.module';
import { PromptManagementModule } from '../prompt-management/prompt-management.module';

@Module({
  imports: [
    ConfigModule,
    OpenAIModule,
    PromptManagementModule,
    BullModule.registerQueue({
      name: TRANSCRIPTION_QUEUE,
    }),
  ],
  providers: [
    TranscriptionService,
    TranscriptionProducerService,
    TranscriptionConsumer,
  ],
  exports: [TranscriptionService, TranscriptionProducerService],
})
export class TranscriptionModule {}
