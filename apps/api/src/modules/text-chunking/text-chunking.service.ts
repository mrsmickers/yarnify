import { Injectable, Logger } from '@nestjs/common';
import { get_encoding } from 'tiktoken';

@Injectable()
export class TextChunkingService {
  private readonly logger = new Logger(TextChunkingService.name);

  private readonly encoding = get_encoding('cl100k_base'); // Used by text-embedding-3-small

  private countTokens(text: string): number {
    return this.encoding.encode(text).length;
  }

  chunkText(
    text: string,
    chunkSizeTokens = 6000, // Reduced for safer margin with text-embedding-3-small (max 8191)
    overlapTokens = 200,
  ): string[] {
    if (!text) {
      return [];
    }

    const chunks: string[] = [];
    let currentPosition = 0;

    // Split text into sentences for better chunking boundaries
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let currentTokenCount = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);
      
      // If adding this sentence would exceed chunk size, save current chunk and start new one
      if (currentTokenCount + sentenceTokens > chunkSizeTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Handle overlap by keeping some text from the end of the previous chunk
        if (overlapTokens > 0) {
          const overlapText = this.getOverlapText(currentChunk, overlapTokens);
          currentChunk = overlapText + ' ' + sentence;
          currentTokenCount = this.countTokens(currentChunk);
        } else {
          currentChunk = sentence;
          currentTokenCount = sentenceTokens;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokenCount += sentenceTokens;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Validate chunks don't exceed token limit
    const validatedChunks = chunks.filter(chunk => {
      const tokenCount = this.countTokens(chunk);
      if (tokenCount > chunkSizeTokens) {
        this.logger.warn(`Chunk exceeds token limit: ${tokenCount} tokens. Skipping.`);
        return false;
      }
      return chunk.trim() !== '';
    });

    this.logger.log(`Chunked text into ${validatedChunks.length} chunks.`);
    return validatedChunks;
  }

  private getOverlapText(text: string, overlapTokens: number): string {
    const tokens = this.encoding.encode(text);
    if (tokens.length <= overlapTokens) {
      return text;
    }
    
    const overlapTokensArray = tokens.slice(-overlapTokens);
    const decoded = this.encoding.decode(overlapTokensArray);
    return new TextDecoder().decode(decoded);
  }
}
