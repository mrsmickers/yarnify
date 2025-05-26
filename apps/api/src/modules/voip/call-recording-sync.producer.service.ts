import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CALL_RECORDING_SYNC_QUEUE } from './constants';

@Injectable()
export class CallRecordingSyncProducerService implements OnModuleInit {
  constructor(
    @InjectQueue(CALL_RECORDING_SYNC_QUEUE)
    private readonly callRecordingSyncQueue: Queue,
  ) {}

  // log
  private readonly logger: Logger = new Logger(
    CallRecordingSyncProducerService.name,
  );

  async onModuleInit() {
    await this.scheduleCallRecordingSync();
  }

  async scheduleCallRecordingSync() {
    // Remove any existing repeatable jobs with the same ID to prevent duplicates
    const repeatableJobs =
      await this.callRecordingSyncQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === 'sync-call-recordings') {
        await this.callRecordingSyncQueue.removeRepeatableByKey(job.key);
      }
    }

    await this.callRecordingSyncQueue.add(
      'sync-call-recordings-job', // Job name
      {}, // Job data (if any, not needed for a simple cron)
      {
        repeat: {
          every: 15 * 60 * 1000, // 15 minutes in milliseconds
        },
        jobId: 'sync-call-recordings', // Unique ID for this repeatable job
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    this.logger.log(
      'Scheduled call recording sync job to run every 15 minutes.',
    );
  }
}
