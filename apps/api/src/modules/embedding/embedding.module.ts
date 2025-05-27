import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [ConfigModule, OpenAIModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
