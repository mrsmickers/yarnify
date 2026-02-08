-- CreateTable
CREATE TABLE "sentiment_alert_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sentimentValues" TEXT[],
    "frustrationMin" TEXT,
    "flagForReview" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmails" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sentiment_alert_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_alerts" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "callAnalysisId" TEXT NOT NULL,
    "configId" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "sentiment" TEXT,
    "frustration" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sentiment_alerts_callId_idx" ON "sentiment_alerts"("callId");

-- CreateIndex
CREATE INDEX "sentiment_alerts_alertType_idx" ON "sentiment_alerts"("alertType");

-- CreateIndex
CREATE INDEX "sentiment_alerts_reviewedAt_idx" ON "sentiment_alerts"("reviewedAt");

-- CreateIndex
CREATE INDEX "sentiment_alerts_dismissedAt_idx" ON "sentiment_alerts"("dismissedAt");

-- AddForeignKey
ALTER TABLE "sentiment_alerts" ADD CONSTRAINT "sentiment_alerts_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default alert config
INSERT INTO "sentiment_alert_configs" ("id", "name", "isActive", "sentimentValues", "frustrationMin", "flagForReview", "notifyEmails", "createdAt", "updatedAt")
VALUES ('default-sentiment-alert', 'Default Negative Sentiment Alert', true, ARRAY['Negative', 'Very Negative'], 'High', true, ARRAY[]::text[], NOW(), NOW())
ON CONFLICT DO NOTHING;
