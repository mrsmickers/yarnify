import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { TRANSCRIPTION_QUEUE } from './constants';

export interface TranscriptionJobData {
  audioBase64: string; // Or path to audio file, depending on your setup
  mimeType: string;
  jobId?: string; // Optional: if you want to assign a specific ID
  // Add any other relevant data needed for transcription
}

@Injectable()
export class TranscriptionProducerService {
  constructor(
    @InjectQueue(TRANSCRIPTION_QUEUE)
    private readonly transcriptionQueue: Queue,
  ) {}

  async addTranscriptionJob(data: TranscriptionJobData): Promise<void> {
    const jobOptions = data.jobId ? { jobId: data.jobId } : {};
    await this.transcriptionQueue.add('transcribeAudio', data, jobOptions);
    // Consider logging job addition
  }
}
