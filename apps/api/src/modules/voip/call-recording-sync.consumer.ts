import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CallRecordingService } from './call-recording.service';
import { CALL_RECORDING_SYNC_QUEUE } from './constants';
import { Logger } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
// StorageService and CallProcessingProducerService are now used by CallRecordingService
dayjs.extend(relativeTime);

@Processor(CALL_RECORDING_SYNC_QUEUE)
export class CallRecordingSyncConsumer extends WorkerHost {
  private readonly logger = new Logger(CallRecordingSyncConsumer.name);

  constructor(private readonly callRecordingService: CallRecordingService) {
    super();
  }

  async process(job: Job<void, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} - ${job.name}`);
    try {
      // Fetch recordings from the last 1 hour
      const now = dayjs().add(1, 'hour'); // Add 1 hour to ensure we capture the last hour correctly
      const startTime = now.subtract(24, 'hour');

      this.logger.log(
        `Fetching call recordings from ${startTime.toISOString()} to ${now.toISOString()}`,
      );

      // Use the new internal service method. It will list recordings and queue them
      // for detailed processing via CallProcessingProducerService.
      await this.callRecordingService.processRecordingsByDateRangeInternal(
        startTime.toISOString(),
        now.toISOString(),
      );

      this.logger.log(
        `Successfully processed job ${job.id} - ${job.name}. Recordings from the last 1 hour have been queued for processing.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process job ${job.id} - ${job.name}`,
        error.stack,
      );
      throw error; // Re-throw error to let BullMQ handle job failure
    }
  }
}
