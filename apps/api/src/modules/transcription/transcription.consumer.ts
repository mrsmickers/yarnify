import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TranscriptionService } from './transcription.service';
import { TRANSCRIPTION_QUEUE } from './constants';
import { TranscriptionJobData } from './transcription.producer.service';
import { Logger } from '@nestjs/common';

@Processor(TRANSCRIPTION_QUEUE, { concurrency: 5 })
export class TranscriptionConsumer extends WorkerHost {
  private readonly logger = new Logger(TranscriptionConsumer.name);

  constructor(private readonly transcriptionService: TranscriptionService) {
    super();
  }

  async process(job: Job<TranscriptionJobData, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    try {
      const { audioBase64, mimeType } = job.data;
      // Assuming transcriptionService.transcribeAudio returns the transcription text
      const transcription = await this.transcriptionService.transcribeAudio(
        audioBase64,
        mimeType,
      );

      this.logger.log(`Job ${job.id} completed successfully.`);
      // Here you might want to save the transcription, emit an event, etc.
      return { transcription };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
      throw error; // Re-throw error to let BullMQ handle job failure
    }
  }
}
