import { Module } from '@nestjs/common';
import { TextChunkingService } from './text-chunking.service';

@Module({
  providers: [TextChunkingService],
  exports: [TextChunkingService],
})
export class TextChunkingModule {}
