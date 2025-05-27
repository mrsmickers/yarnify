CREATE EXTENSION IF NOT EXISTS vector;
-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "transcriptUrl" TEXT;

-- CreateTable
CREATE TABLE "CallTranscriptEmbedding" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "callId" TEXT NOT NULL,
    "chunkSequence" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "modelName" TEXT NOT NULL,

    CONSTRAINT "CallTranscriptEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallTranscriptEmbedding_callId_idx" ON "CallTranscriptEmbedding"("callId");

-- CreateIndex
CREATE INDEX "CallTranscriptEmbedding_callId_chunkSequence_idx" ON "CallTranscriptEmbedding"("callId", "chunkSequence");

-- CreateIndex
CREATE UNIQUE INDEX "CallTranscriptEmbedding_callId_chunkSequence_key" ON "CallTranscriptEmbedding"("callId", "chunkSequence");

-- AddForeignKey
ALTER TABLE "CallTranscriptEmbedding" ADD CONSTRAINT "CallTranscriptEmbedding_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
