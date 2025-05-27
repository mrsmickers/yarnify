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
} from '@nestjs/common';
import { Request, Response } from 'express';
import { StorageService } from './storage.service';
import { CallRepository } from '../call-analysis/repositories/call.repository';
import { ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import * as path from 'path';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
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
      throw new NotFoundException('Call recording not found');
    }

    const fileName = path.basename(call.recordingUrl);
    const buffer = await this.storageService.getFile(
      `call-recordings/${fileName}`,
    );

    // Set Content-Disposition to attachment to force download
    response.set({
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    return new StreamableFile(buffer);
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
    const call = await this.callRepository.findById(callId);
    if (!call || !call.recordingUrl) {
      throw new NotFoundException('Call recording not found');
    }

    const fileName = path.basename(call.recordingUrl);
    const filePath = `call-recordings/${fileName}`;

    const fileStats = await this.storageService.getFileStats(filePath);
    if (!fileStats) {
      throw new NotFoundException('Recording file stats not found');
    }
    const fileSize = fileStats.contentLength;

    response.setHeader('Content-Type', 'audio/mpeg');
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Disposition', 'inline');

    const range = request.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        response.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
        response.setHeader('Content-Range', `bytes */${fileSize}`);
        // Return an empty streamable file or handle error appropriately
        // For now, we'll let it fall through, but ideally, we'd throw or return nothing.
        // However, NestJS passthrough means we must return a StreamableFile or throw.
        // Let's throw an error that the frontend won't try to play.
        // This case should be rare if the browser behaves.
        throw new NotFoundException('Invalid range requested.');
      }

      const chunksize = end - start + 1;

      // Assuming storageService.getStreamableFileRange returns a StreamableFile
      // This method needs to be implemented in StorageService
      const fileStream = await this.storageService.getStreamableFileRange(
        filePath,
        start,
        end,
      );

      response.status(HttpStatus.PARTIAL_CONTENT);
      response.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      response.setHeader('Content-Length', chunksize.toString());

      return fileStream; // This should be a StreamableFile from the service
    } else {
      // No range requested, send the whole file
      response.setHeader('Content-Length', fileSize.toString());
      // Assuming storageService.getStreamableFile returns a StreamableFile of the whole file
      // This might need adjustment if getFile returns a buffer
      const fullFileStream = await this.storageService.getStreamableFile(
        filePath,
      );
      return fullFileStream; // This should be a StreamableFile from the service
    }
  }
}
