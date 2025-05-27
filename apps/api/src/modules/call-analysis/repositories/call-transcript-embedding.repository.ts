import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, CallTranscriptEmbedding } from '../../../../generated/prisma';
import { createId } from '@paralleldrive/cuid2';

@Injectable()
export class CallTranscriptEmbeddingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    callId: string;
    chunkSequence: number;
    embedding: number[];
    modelName: string;
    id?: string; // Optional, as cuid() will generate it
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    // Changed return type as $executeRawUnsafe returns count
    // Construct the vector string representation for SQL
    const vectorString = `[${data.embedding.join(',')}]`;
    const id = data.id || createId(); // Generate CUID if not provided

    // Note: Using $executeRawUnsafe. Ensure data is sanitized if coming from user input.
    // Here, it's internally generated, so less risk.
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "CallTranscriptEmbedding" ("id", "createdAt", "updatedAt", "callId", "chunkSequence", "embedding", "modelName")
       VALUES ($1, COALESCE($2, NOW()), COALESCE($3, NOW()), $4, $5, $6::vector, $7)`,
      id,
      data.createdAt,
      data.updatedAt,
      data.callId,
      data.chunkSequence,
      vectorString,
      data.modelName,
    );
    // If you need the created entity, you might need a subsequent find,
    // or structure this differently if $queryRaw can return the created row.
    // For now, simplifying to void return for create.
  }

  async findByCallId(callId: string): Promise<CallTranscriptEmbedding[]> {
    return this.prisma.callTranscriptEmbedding.findMany({
      where: { callId },
      orderBy: { chunkSequence: 'asc' },
    });
  }

  async findByCallIdAndChunkSequence(
    callId: string,
    chunkSequence: number,
  ): Promise<CallTranscriptEmbedding | null> {
    return this.prisma.callTranscriptEmbedding.findUnique({
      where: { callId_chunkSequence: { callId, chunkSequence } },
    });
  }

  // Add other methods as needed, e.g., update, delete
}
