import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CALL_PROCESSING_QUEUE } from '../transcription/constants'; // Assuming constants are still there
import { CallProcessingJobData } from './dto/call-processing-job.dto';

@Injectable()
export class CallProcessingProducerService {
  constructor(
    @InjectQueue(CALL_PROCESSING_QUEUE)
    private readonly callProcessingQueue: Queue<CallProcessingJobData>,
  ) {}

  async addCallToProcessingQueue(jobData: CallProcessingJobData) {
    await this.callProcessingQueue.add('process-call', jobData, {
      // Options like attempts, backoff, etc., can be configured here
      attempts: 1,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
      removeOnComplete: true, // Automatically remove completed jobs
    });
    // console.log(`Job added to ${CALL_PROCESSING_QUEUE} for call ID: ${jobData.callRecordingId}`);
  }
}
