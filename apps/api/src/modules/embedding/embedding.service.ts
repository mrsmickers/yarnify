import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { get_encoding } from 'tiktoken';
import { LLMConfigService } from '../prompt-management/llm-config.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly encoding = get_encoding('cl100k_base'); // Used by text-embedding-3-small

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly llmConfigService: LLMConfigService,
  ) {}

  async generateEmbedding(
    textChunk: string,
    model?: string,
  ): Promise<number[]> {
    // Fetch active LLM config for embeddings from database
    const embeddingConfig = await this.llmConfigService.findActiveByUseCase('EMBEDDINGS');
    const effectiveModel = embeddingConfig?.modelName || model || 'text-embedding-3-small';
    if (!textChunk || textChunk.trim() === '') {
      this.logger.warn('Attempted to generate embedding for empty text.');
      // Decide if to return empty array or throw error. For now, returning empty.
      // Consider implications for pgvector if it cannot store empty/null vectors.
      return [];
    }

    // Validate token count before sending to OpenAI
    const tokenCount = this.encoding.encode(textChunk).length;
    const maxTokens = 8191; // text-embedding-3-small limit
    
    if (tokenCount > maxTokens) {
      this.logger.error(
        `Text chunk exceeds token limit: ${tokenCount} tokens (max: ${maxTokens})`,
      );
      throw new Error(
        `Text chunk exceeds token limit: ${tokenCount} tokens (max: ${maxTokens})`,
      );
    }

    try {
      this.logger.debug(
        `Generating embedding for chunk starting with: "${textChunk.substring(
          0,
          50,
        )}..." using model ${effectiveModel} (${tokenCount} tokens)`,
      );

      const embeddings = await this.openaiService.createEmbeddings(
        textChunk.replace(/\n/g, ' '), // OpenAI recommends replacing newlines
        effectiveModel,
      );

      if (embeddings && embeddings.length > 0 && embeddings[0].embedding) {
        this.logger.debug(`Successfully generated embedding for chunk.`);
        return embeddings[0].embedding;
      } else {
        this.logger.error('OpenAI API returned no embedding data.');
        throw new Error('Failed to generate embedding: No data returned.');
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error.message}`,
        error.stack,
      );
      // Consider more specific error handling or re-throwing for the consumer to handle
      throw error;
    }
  }
}
