import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MARKETING_SYNC_QUEUE, MARKETING_SYNC_JOB_PREFIX } from './constants';

@Injectable()
export class MarketingSyncProducer implements OnModuleInit {
  private readonly logger = new Logger(MarketingSyncProducer.name);

  constructor(
    @InjectQueue(MARKETING_SYNC_QUEUE)
    private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.scheduleAllSyncs();
  }

  /**
   * Remove existing repeatable jobs and re-schedule from DB config.
   */
  async scheduleAllSyncs() {
    // Clean existing repeatable jobs
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      await this.queue.removeRepeatableByKey(job.key);
    }

    // Schedule enabled syncs that have a cron expression
    const syncs = await this.prisma.marketingSync.findMany({
      where: { enabled: true, schedule: { not: null } },
    });

    for (const sync of syncs) {
      if (!sync.schedule) continue;
      const jobName = `${MARKETING_SYNC_JOB_PREFIX}-${sync.id}`;
      await this.queue.add(
        jobName,
        { syncId: sync.id, triggeredBy: 'schedule' },
        {
          repeat: { pattern: sync.schedule },
          jobId: jobName,
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
      this.logger.log(
        `Scheduled marketing sync "${sync.name}" (${sync.id}) with cron: ${sync.schedule}`,
      );
    }
  }

  /**
   * Trigger a one-off sync immediately.
   */
  async triggerSync(syncId: string) {
    const jobName = `${MARKETING_SYNC_JOB_PREFIX}-${syncId}-manual`;
    await this.queue.add(
      jobName,
      { syncId, triggeredBy: 'manual' },
      {
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
    this.logger.log(`Queued manual marketing sync for ${syncId}`);
  }
}
