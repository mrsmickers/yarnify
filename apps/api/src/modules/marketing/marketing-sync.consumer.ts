import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { MARKETING_SYNC_QUEUE } from './constants';
import { MarketingSyncService } from './marketing-sync.service';

interface MarketingSyncJobData {
  syncId: string;
  triggeredBy: 'manual' | 'schedule';
}

@Injectable()
@Processor(MARKETING_SYNC_QUEUE)
export class MarketingSyncConsumer extends WorkerHost {
  private readonly logger = new Logger(MarketingSyncConsumer.name);

  constructor(private readonly syncService: MarketingSyncService) {
    super();
  }

  async process(job: Job<MarketingSyncJobData, any, string>): Promise<any> {
    const { syncId, triggeredBy } = job.data;
    this.logger.log(
      `Processing marketing sync job ${job.id} — syncId: ${syncId}, trigger: ${triggeredBy}`,
    );

    try {
      const runId = await this.syncService.executeSync(syncId, triggeredBy);
      this.logger.log(
        `Marketing sync job ${job.id} completed — runId: ${runId}`,
      );
      return { runId };
    } catch (error) {
      this.logger.error(
        `Marketing sync job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
