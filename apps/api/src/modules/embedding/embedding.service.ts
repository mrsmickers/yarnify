import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not configured.');
      throw new Error('OPENAI_API_KEY is not configured.');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async generateEmbedding(
    textChunk: string,
    model = 'text-embedding-ada-002',
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
      const response = await this.openai.embeddings.create({
        model: model,
        input: textChunk.replace(/\n/g, ' '), // OpenAI recommends replacing newlines
      });

      if (
        response.data &&
        response.data.length > 0 &&
        response.data[0].embedding
      ) {
        this.logger.debug(`Successfully generated embedding for chunk.`);
        return response.data[0].embedding;
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
