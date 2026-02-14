-- Resolution Knowledge Base tables

-- Resolved tickets stored as anonymised, embedded knowledge entries
CREATE TABLE "resolution_entries" (
    "id" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "ticketSummary" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "board" TEXT,
    "type" TEXT,
    "subtype" TEXT,
    "item" TEXT,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "resolution" TEXT,
    "combinedText" TEXT NOT NULL,
    "minutesToResolve" INTEGER,
    "embedding" vector(1024) NOT NULL,
    "embeddingModel" TEXT NOT NULL DEFAULT 'nvidia/nv-embedqa-e5-v5',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_entries_pkey" PRIMARY KEY ("id")
);

-- Sync state tracker
CREATE TABLE "resolution_sync_state" (
    "id" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "totalSynced" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_sync_state_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "resolution_entries_ticketId_key" ON "resolution_entries"("ticketId");
CREATE INDEX "resolution_entries_closedAt_idx" ON "resolution_entries"("closedAt");
CREATE INDEX "resolution_entries_board_idx" ON "resolution_entries"("board");
CREATE INDEX "resolution_entries_type_idx" ON "resolution_entries"("type");

-- HNSW index for fast vector similarity search (cosine distance)
CREATE INDEX "resolution_entries_embedding_idx" ON "resolution_entries"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
