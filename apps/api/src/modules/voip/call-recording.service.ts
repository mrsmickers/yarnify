import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  CallRecordResponse,
  // CallRecordResponseSchema, // Not directly used in this file after refactor
  ListCallRecordings,
  // ListCallRecordingsSchema, // Not directly used in this file after refactor
  CallRecord, // This is the type for items in ListCallRecordings.data
} from './dto/call-recording.dto';
import { StorageService } from '../storage/storage.service';
import { CallProcessingProducerService } from '../call-analysis/call-processing.producer.service';
import { CallProcessingJobData } from '../call-analysis/dto/call-processing-job.dto';
import { CallRepository } from '../call-analysis/repositories/call.repository';
import { dayjs } from '../../lib/dayjs';
import { NTAExtension } from './dto/extension.dto';
// Removed CallStatus import as it's a string literal

@Injectable()
export class CallRecordingService {
  private readonly logger = new Logger(CallRecordingService.name);
  private readonly voipUsername: string;
  private readonly voipPassword: string;
  private readonly voipBaseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService, // Kept if fetchCallRecording is used by consumer via this service
    private readonly callProcessingProducer: CallProcessingProducerService,
    private readonly callRepository: CallRepository,
  ) {
    this.voipUsername = this.configService.get<string>('VOIP_USERNAME');
    this.voipPassword = this.configService.get<string>('VOIP_PASSWORD');
    this.voipBaseUrl = this.configService.get<string>('VOIP_BASE_URL');

    if (!this.voipUsername || !this.voipPassword || !this.voipBaseUrl) {
      throw new InternalServerErrorException(
        'VOIP_USERNAME, VOIP_PASSWORD, and VOIP_BASE_URL environment variables must be set',
      );
    }
  }

  async listCallRecordings(
    startDate: string, // unix timestamps
    endDate: string,
  ): Promise<ListCallRecordings> {
    const url = `${this.voipBaseUrl}/api/json/recording/recordings/list?auth_username=${this.voipUsername};auth_password=${this.voipPassword};recordgroup=4303;start=${startDate};end=${endDate}`;
    this.logger.log(
      `Listing call recordings from: ${this.voipBaseUrl}/api/json/recording/recordings/list with start date: ${startDate} and end date: ${endDate}`,
    );
    const { data } = await firstValueFrom(
      this.httpService.get<ListCallRecordings>(url),
    );
    return data;
  }

  // This method will be called by the CallProcessingConsumer
  async fetchCallRecording(
    uniqueid: string,
    recordgroup = '4303',
    recordid = '2',
    encoding = 'base64',
  ): Promise<CallRecordResponse> {
    // Returns the full response including base64 data
    const url = `${this.voipBaseUrl}/api/json/recording/recordings/get?auth_username=${this.voipUsername}&auth_password=${this.voipPassword}&recordgroup=${recordgroup}&uniqueid=${uniqueid}&recordid=${recordid}&encoding=${encoding}`;
    this.logger.log(
      `Fetching call recording from: ${this.voipBaseUrl}/api/json/recording/recordings/get with uniqueid: ${uniqueid}`,
    );
    const { data, status } = await firstValueFrom(
      this.httpService.get<CallRecordResponse>(url),
    );
    if (status !== 200 || !data || !data.data) {
      // Ensure data and data.data exist
      this.logger.error(
        `Failed to retrieve recording for uniqueid ${uniqueid}. Status: ${status}`,
      );
      throw new InternalServerErrorException(
        `Failed to retrieve the recording data for uniqueid ${uniqueid}`,
      );
    }
    return data;
  }

  // This method is intended for use by the VoipController or other internal services
  // that might need to initiate processing for a date range and potentially act on the list of recordings.
  async getRecordingsByDateRangeAndQueue(
    startDateIso: string,
    endDateIso: string,
  ): Promise<CallRecord[]> {
    this.logger.log(
      `getRecordingsByDateRangeAndQueue called with startDate: ${startDateIso}, endDate: ${endDateIso}`,
    );
    return this.processRecordingsByDateRangeInternal(startDateIso, endDateIso);
  }

  // Core logic for fetching and queuing recordings, callable internally or by specific consumers.
  async processRecordingsByDateRangeInternal(
    startDateIso: string,
    endDateIso: string,
  ): Promise<CallRecord[]> {
    this.logger.log(
      `processRecordingsByDateRangeInternal called with startDate: ${startDateIso}, endDate: ${endDateIso}`,
    );
    const startDateUnix = dayjs(startDateIso).unix().toString();
    const endDateUnix = dayjs(endDateIso).unix().toString();

    const listedRecordingsResponse = await this.listCallRecordings(
      startDateUnix,
      endDateUnix,
    );

    if (
      !listedRecordingsResponse ||
      !listedRecordingsResponse.data ||
      listedRecordingsResponse.data.length === 0
    ) {
      this.logger.log('No recordings found in the specified date range.');
      return [];
    }

    const listedRecordings = listedRecordingsResponse.data;
    this.logger.log(
      `Found ${listedRecordings.length} recordings in range. Queuing for processing...`,
    );
    const processedRecordings: CallRecord[] = [];
    for (const listedRec of listedRecordings) {
      try {
        const existingCall = await this.callRepository.findByCallSid(
          listedRec.uniqueid,
        );

        if (existingCall) {
          // Re-queue FAILED or QUEUED calls, skip COMPLETED ones
          if (existingCall.callStatus === 'COMPLETED' || existingCall.callStatus === 'INTERNAL_CALL_SKIPPED') {
            this.logger.log(
              `Call ${listedRec.uniqueid} already completed with status ${existingCall.callStatus}. Skipping.`,
            );
            continue;
          }
          // Reset status to PROCESSING for retry
          await this.callRepository.update(existingCall.id, { callStatus: 'PROCESSING' });
          this.logger.log(
            `Call ${listedRec.uniqueid} was ${existingCall.callStatus}, re-queuing for processing.`,
          );
        }

        const jobData: CallProcessingJobData = {
          callRecordingId: listedRec.uniqueid,
        };

        processedRecordings.push(listedRec);
        await this.callProcessingProducer.addCallToProcessingQueue(jobData);
        this.logger.log(
          `Queued call processing job for uniqueid ${listedRec.uniqueid}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to queue job for recording ${listedRec.uniqueid}: ${error.message}`,
        );
      }
    }
    return processedRecordings;
  }

  async getExtension(extension: string): Promise<NTAExtension | undefined> {
    const customerId = this.configService.get<string>('VOIP_CUSTOMER_ID');
    const url = `${this.voipBaseUrl}/api/json/phones/get?auth_username=${this.voipUsername}&auth_password=${this.voipPassword}&name=${extension}&customer=${customerId}`;

    const { data } = await firstValueFrom(this.httpService.get(url));
    return data.data;
  }
}
