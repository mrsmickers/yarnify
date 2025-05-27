import { Injectable, Logger } from '@nestjs/common';
// TODO: Install and import a tokenizer like 'tiktoken' for accurate token counting
// import { get_encoding } from 'tiktoken';

@Injectable()
export class TextChunkingService {
  private readonly logger = new Logger(TextChunkingService.name);

  // Placeholder for actual tokenizer
  private countTokens(text: string): number {
    // Basic estimation: split by spaces. Replace with tiktoken for accuracy.
    return text.split(/\s+/).length;
  }

  chunkText(
    text: string,
    chunkSizeTokens = 7500, // Default based on plan (e.g., for text-embedding-ada-002 max 8191)
    overlapTokens = 200,
  ): string[] {
    if (!text) {
      return [];
    }

    const chunks: string[] = [];
    let currentPosition = 0;

    // Simple character-based chunking for now.
    // For token-based chunking, this logic needs to be more sophisticated,
    // iterating and using the tokenizer.
    // This is a simplified version and might not respect token boundaries perfectly.

    const estimatedCharsPerToken = 4; // Rough average
    const chunkSizeChars = chunkSizeTokens * estimatedCharsPerToken;
    const overlapChars = overlapTokens * estimatedCharsPerToken;

    while (currentPosition < text.length) {
      const endPosition = Math.min(
        currentPosition + chunkSizeChars,
        text.length,
      );
      chunks.push(text.substring(currentPosition, endPosition));
      currentPosition = endPosition - overlapChars;
      if (
        currentPosition < endPosition - overlapChars + 1 &&
        endPosition < text.length
      ) {
        // Ensure progress if overlap is large
        currentPosition =
          endPosition -
          overlapChars +
          Math.max(1, Math.floor(chunkSizeChars * 0.1)); // Move forward by at least 10% of chunk if stuck
      }
      if (endPosition === text.length) break;
    }

    // A more robust approach would involve:
    // 1. Splitting text into sentences or paragraphs.
    // 2. Iteratively adding sentences/paragraphs to a chunk until chunkSizeTokens is approached.
    // 3. Implementing overlap by taking some sentences/paragraphs from the end of the previous chunk.

    this.logger.log(`Chunked text into ${chunks.length} chunks.`);
    return chunks.filter((chunk) => chunk.trim() !== ''); // Ensure no empty chunks
  }
}
