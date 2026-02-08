import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { CALL_RECORDING_SYNC_QUEUE } from './constants';

@Injectable()
export class CallRecordingSyncProducerService implements OnModuleInit {
  constructor(
    @InjectQueue(CALL_RECORDING_SYNC_QUEUE)
    private readonly callRecordingSyncQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  // log
  private readonly logger: Logger = new Logger(
    CallRecordingSyncProducerService.name,
  );

  async onModuleInit() {
    const disableSync = this.configService.get<string>('DISABLE_VOIP_SYNC', 'false').toLowerCase() === 'true';
    if (disableSync) {
      this.logger.warn('VoIP auto-sync is DISABLED (DISABLE_VOIP_SYNC=true). Use manual /api/v1/voip/recordings/process to trigger.');
      return;
    }
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
