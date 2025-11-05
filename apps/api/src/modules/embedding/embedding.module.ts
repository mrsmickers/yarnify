import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { ConfigModule } from '@nestjs/config';
import { OpenAIModule } from '../openai/openai.module';
import { PromptManagementModule } from '../prompt-management/prompt-management.module';

@Module({
  imports: [ConfigModule, OpenAIModule, PromptManagementModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
