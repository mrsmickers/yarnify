import { Controller, Get, Query, UsePipes, Logger } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { CallRecordingService } from './call-recording.service';
import {
  GetCallRecordingsQueryDto,
  GetCallRecordingsQuerySchema,
} from './dto/call-recording.dto';
import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
// StorageService and CallProcessingProducerService are now used by CallRecordingService

dayjs.extend(relativeTime);

@Controller('voip')
export class VoipController {
  private readonly logger = new Logger(VoipController.name);

  constructor(private readonly callRecordingService: CallRecordingService) {}

  @Get('recordings/process')
  @UsePipes(new ZodValidationPipe(GetCallRecordingsQuerySchema))
  async processRecordingsByDate(@Query() query: GetCallRecordingsQueryDto) {
    let { startDate, endDate, limit } = query;

    if (!startDate || !endDate) {
      const now = new Date();
      const defaultStartDate = dayjs().subtract(4, 'day'); // Default to last 48 hours
      endDate = now.toISOString();
      startDate = defaultStartDate.toISOString();
      this.logger.log(`Defaulting date range: ${startDate} to ${endDate}`);
    }

    if (limit) {
      this.logger.log(`Limiting processing to last ${limit} recordings`);
    }

    // CallRecordingService.getRecordingsByDateRange now handles fetching,
    // uploading to blob, and queuing for processing.
    // It returns the original list of recordings it found.
    const foundRecordings =
      await this.callRecordingService.getRecordingsByDateRangeAndQueue(
        startDate,
        endDate,
        limit,
      );

    if (!foundRecordings || foundRecordings.length === 0) {
      this.logger.log(
        'No recordings found for the specified date range to process.',
      );
      return {
        message: 'No recordings found for the specified date range to process.',
      };
    }

    // The service handles the actual queuing. The controller's role is simplified.
    this.logger.log(
      `CallRecordingService initiated processing for ${foundRecordings.length} recordings found in the date range.`,
    );

    return {
      message: `Processing initiated for ${foundRecordings.length} recordings. Check server logs for details on individual job queuing.`,
    };
  }
}
