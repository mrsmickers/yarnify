import {
  Controller,
  Get,
  Param,
  Res,
  Header,
  StreamableFile,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { CallRepository } from '../call-analysis/repositories/call.repository';
import { ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import path from 'path';

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
  @Header('Content-Type', 'audio/mpeg')
  @ApiParam({
    name: 'callId',
    description: 'The ID of the call to stream the recording for',
  })
  @ApiResponse({
    status: 200,
    description: 'The call recording as a streamable audio file',
  })
  @ApiResponse({
    status: 404,
    description: 'Call not found or recording not available',
  })
  async streamCallRecording(
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
    
    // Set Content-Disposition to inline for in-browser playback
    response.set({
      'Content-Disposition': 'inline',
    });

    return new StreamableFile(buffer);
  }
}
