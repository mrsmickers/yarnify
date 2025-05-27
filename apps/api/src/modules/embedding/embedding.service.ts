import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(private readonly openaiService: OpenAIService) {}

  async generateEmbedding(
    textChunk: string,
    model = 'text-embedding-3-small',
  ): Promise<number[]> {
    if (!textChunk || textChunk.trim() === '') {
      this.logger.warn('Attempted to generate embedding for empty text.');
      // Decide if to return empty array or throw error. For now, returning empty.
      // Consider implications for pgvector if it cannot store empty/null vectors.
      return [];
    }

    try {
      this.logger.debug(
        `Generating embedding for chunk starting with: "${textChunk.substring(
          0,
          50,
        )}..." using model ${model}`,
      );

      const embeddings = await this.openaiService.createEmbeddings(
        textChunk.replace(/\n/g, ' '), // OpenAI recommends replacing newlines
        model,
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
