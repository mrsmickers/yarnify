-- CreateTable
CREATE TABLE "triage_cache" (
    "id" TEXT NOT NULL,
    "boardId" INTEGER NOT NULL,
    "boardName" TEXT NOT NULL,
    "hierarchy" JSONB NOT NULL,
    "comboCount" INTEGER NOT NULL DEFAULT 0,
    "lastRefreshed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triage_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_aliases" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "notes" TEXT,
    "troubleshootingHints" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triage_logs" (
    "id" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "ticketSummary" TEXT NOT NULL,
    "companyName" TEXT,
    "contactName" TEXT,
    "source" TEXT,
    "board" TEXT,
    "type" TEXT,
    "subtype" TEXT,
    "item" TEXT,
    "priority" TEXT,
    "reasoning" TEXT,
    "troubleshooting" TEXT,
    "matchedProducts" JSONB,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "warnings" JSONB,
    "modelUsed" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "responseTimeMs" INTEGER,
    "error" TEXT,
    "notePosted" BOOLEAN NOT NULL DEFAULT false,
    "notePostedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "triage_cache_boardId_key" ON "triage_cache"("boardId");

-- CreateIndex
CREATE INDEX "triage_logs_ticketId_idx" ON "triage_logs"("ticketId");

-- CreateIndex
CREATE INDEX "triage_logs_createdAt_idx" ON "triage_logs"("createdAt");
