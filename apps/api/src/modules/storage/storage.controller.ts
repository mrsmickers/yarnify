import {
  Controller,
  Get,
  Param,
  Res,
  Header,
  StreamableFile,
  NotFoundException,
  Req,
  HttpStatus,
  Logger, // Import Logger
  HttpException, // Import HttpException
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StorageService } from './storage.service';
import { CallRepository } from '../call-analysis/repositories/call.repository';
import { ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import * as path from 'path';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name); // Add logger instance

  constructor(
    private readonly storageService: StorageService,
    private readonly callRepository: CallRepository,
  ) {}

  @Get('recordings/:callId')
  @Header('Content-Type', 'audio/mpeg')
  @ApiParam({
    name: 'callId',
    description: 'The ID of the call to download the recording for',
  })
  @ApiResponse({
    status: 200,
    description: 'The call recording as an audio file',
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found or recording not available',
  })
  async getCallRecording(
    @Param('callId') callId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const call = await this.callRepository.findById(callId);
    if (!call || !call.recordingUrl) {
      this.logger.warn(`Recording not found for call ID: ${callId}`);
      throw new NotFoundException('Call recording not found');
    }

    const fileName = path.basename(call.recordingUrl);
    const filePath = `call-recordings/${fileName}`;
    this.logger.log(`Attempting to download recording: ${filePath}`);

    try {
      const buffer = await this.storageService.getFile(filePath);

      response.set({
        'Content-Disposition': `attachment; filename=\"${fileName}\"`,
      });
      this.logger.log(
        `Successfully prepared recording ${fileName} for download.`,
      );
      return new StreamableFile(buffer);
    } catch (error) {
      this.logger.error(
        `Failed to get recording ${filePath} for call ${callId}: ${error.message}`,
      );
      if (error.statusCode === 404) {
        throw new NotFoundException('Recording file not found in storage.');
      }
      throw error;
    }
  }

  @Get('recordings/stream/:callId')
  @ApiParam({
    name: 'callId',
    description: 'The ID of the call to stream the recording for',
  })
  @ApiResponse({
    status: 200,
    description:
      'The call recording as a streamable audio file (full content).',
  })
  @ApiResponse({
    status: 206,
    description: 'Partial content of the call recording.',
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found or recording not available.',
  })
  @ApiResponse({
    status: 416,
    description: 'Range not satisfiable.',
  })
  async streamCallRecording(
    @Param('callId') callId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    this.logger.log(
      `Stream request for call ID: ${callId}, Range: ${
        request.headers.range || 'None'
      }`,
    );
    const call = await this.callRepository.findById(callId);
    if (!call || !call.recordingUrl) {
      this.logger.warn(
        `Recording not found for call ID: ${callId} during stream request.`,
      );
      throw new NotFoundException('Call recording not found');
    }

    const fileName = path.basename(call.recordingUrl);
    const filePath = `call-recordings/${fileName}`;
    this.logger.log(`Streaming recording from path: ${filePath}`);

    const fileStats = await this.storageService.getFileStats(filePath);
    if (!fileStats || fileStats.contentLength === undefined) {
      this.logger.error(
        `File stats not found or content length undefined for ${filePath}.`,
      );
      throw new NotFoundException(
        'Recording file stats not found or incomplete.',
      );
    }
    const fileSize = fileStats.contentLength;
    this.logger.log(`File size for ${filePath}: ${fileSize} bytes.`);

    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Disposition', 'inline'); // Suggest inline playback

    const range = request.headers.range;

    if (range) {
      this.logger.log(`Processing range request: ${range}`);
      const parts = range.replace(/bytes=/, '').split('-');
      const startString = parts[0];
      const endString = parts[1];

      if (!startString && !endString) {
        this.logger.warn(
          `Invalid range header (both start and end missing): ${range}`,
        );
        throw new HttpException(
          'Invalid Range header',
          HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        );
      }

      const start = parseInt(startString, 10);
      let end = endString ? parseInt(endString, 10) : fileSize - 1;

      if (
        isNaN(start) ||
        (endString && isNaN(end)) ||
        start < 0 ||
        end < 0 ||
        start > end ||
        start >= fileSize
      ) {
        this.logger.warn(
          `Invalid range: start=${start}, end=${end}, fileSize=${fileSize}. Header: ${range}`,
        );
        response.setHeader('Content-Range', `bytes */${fileSize}`);
        throw new HttpException(
          'Requested range not satisfiable',
          HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
        );
      }

      // Ensure end does not exceed fileSize - 1
      if (end >= fileSize) {
        end = fileSize - 1;
      }

      const chunksize = end - start + 1;
      this.logger.log(
        `Serving range: bytes ${start}-${end}/${fileSize}, chunksize: ${chunksize}`,
      );

      try {
        const fileStream = await this.storageService.getStreamableFileRange(
          filePath,
          start,
          end,
        );
        response.status(HttpStatus.PARTIAL_CONTENT);
        response.setHeader(
          'Content-Range',
          `bytes ${start}-${end}/${fileSize}`,
        );
        response.setHeader('Content-Length', chunksize.toString());
        this.logger.log(`Returning partial content stream for ${filePath}.`);
        return fileStream;
      } catch (error) {
        this.logger.error(
          `Error streaming range ${start}-${end} for ${filePath}: ${error.message}`,
        );
        if (error.statusCode === 404) {
          throw new NotFoundException(
            'Recording file not found in storage for range request.',
          );
        }
        throw error;
      }
    } else {
      this.logger.log(`Serving full file request for ${filePath}.`);
      response.setHeader('Content-Length', fileSize.toString());
      try {
        const fullFileStream = await this.storageService.getStreamableFile(
          filePath,
        );
        this.logger.log(`Returning full file stream for ${filePath}.`);
        return fullFileStream;
      } catch (error) {
        this.logger.error(
          `Error streaming full file ${filePath}: ${error.message}`,
        );
        if (error.statusCode === 404) {
          throw new NotFoundException(
            'Recording file not found in storage for full file request.',
          );
        }
        throw error;
      }
    }
  }

  @Get('transcripts/download/:callId') // Changed endpoint to avoid confusion with streaming
  @ApiParam({
    name: 'callId',
    description: 'The ID of the call to download the transcript for',
  })
  @ApiResponse({
    status: 200,
    description: 'The call transcript as a text file.',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found or transcript not available.',
  })
  async downloadCallTranscript(
    // Renamed method
    @Param('callId') callId: string,
    @Res() response: Response, // Removed passthrough
  ): Promise<void> {
    const call = await this.callRepository.findById(callId);
    if (!call || !call.transcriptUrl) {
      this.logger.warn(`Transcript not found for call ID: ${callId}`);
      throw new NotFoundException('Call transcript not found');
    }

    const filePath = call.transcriptUrl; // transcriptUrl should be the full path like 'transcripts/filename.txt'
    this.logger.log(`Attempting to download transcript: ${filePath}`);

    try {
      const buffer = await this.storageService.getFile(filePath);
      const transcriptText = buffer.toString('utf-8');
      const fileName = path.basename(filePath) || `transcript_${callId}.txt`;

      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename=\"${fileName}\"`,
      );
      response.setHeader(
        'Content-Length',
        Buffer.byteLength(transcriptText, 'utf8').toString(),
      );
      this.logger.log(
        `Successfully prepared transcript ${fileName} for download. Length: ${transcriptText.length}`,
      );
      response.send(transcriptText);
    } catch (error) {
      this.logger.error(
        `Failed to get transcript ${filePath} for call ${callId}: ${error.message}`,
      );
      if (error.statusCode === 404 || error.message?.includes('not found')) {
        throw new NotFoundException('Transcript file not found in storage.');
      }
      // Ensure a response is sent in case of other errors if not already handled
      if (!response.headersSent) {
        response
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send('Failed to retrieve transcript');
      }
      // No need to throw error again if response is sent, but good for logging
      // throw error;
    }
  }
}
