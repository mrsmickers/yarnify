-- Add tables and columns that were created via prisma db push but not migrations
-- This migration brings the staging DB in sync with the schema

-- Add prompt_templates table
CREATE TABLE IF NOT EXISTS "prompt_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "prompt_templates_useCase_idx" ON "prompt_templates"("useCase");
CREATE INDEX IF NOT EXISTS "prompt_templates_isActive_idx" ON "prompt_templates"("isActive");

-- Add llm_configurations table
CREATE TABLE IF NOT EXISTS "llm_configurations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "useCase" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "llm_configurations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "llm_configurations_useCase_idx" ON "llm_configurations"("useCase");
CREATE INDEX IF NOT EXISTS "llm_configurations_isActive_idx" ON "llm_configurations"("isActive");

-- Add department_keyword_triggers table
CREATE TABLE IF NOT EXISTS "department_keyword_triggers" (
    "id" TEXT NOT NULL,
    "department" TEXT,
    "keyword" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL DEFAULT 'TRAINING_ALERT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "department_keyword_triggers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "department_keyword_triggers_department_idx" ON "department_keyword_triggers"("department");
CREATE INDEX IF NOT EXISTS "department_keyword_triggers_isActive_idx" ON "department_keyword_triggers"("isActive");

-- Add keyword_alerts table
CREATE TABLE IF NOT EXISTS "keyword_alerts" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "agentId" TEXT,
    "matchedText" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "keyword_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "keyword_alerts_callId_idx" ON "keyword_alerts"("callId");
CREATE INDEX IF NOT EXISTS "keyword_alerts_triggerId_idx" ON "keyword_alerts"("triggerId");
CREATE INDEX IF NOT EXISTS "keyword_alerts_agentId_idx" ON "keyword_alerts"("agentId");
CREATE INDEX IF NOT EXISTS "keyword_alerts_reviewedAt_idx" ON "keyword_alerts"("reviewedAt");

ALTER TABLE "keyword_alerts" ADD CONSTRAINT "keyword_alerts_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "keyword_alerts" ADD CONSTRAINT "keyword_alerts_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "department_keyword_triggers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "keyword_alerts" ADD CONSTRAINT "keyword_alerts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add missing columns to CallAnalysis
ALTER TABLE "CallAnalysis" ADD COLUMN IF NOT EXISTS "promptTemplateId" TEXT;
ALTER TABLE "CallAnalysis" ADD COLUMN IF NOT EXISTS "llmConfigId" TEXT;

CREATE INDEX IF NOT EXISTS "CallAnalysis_promptTemplateId_idx" ON "CallAnalysis"("promptTemplateId");
CREATE INDEX IF NOT EXISTS "CallAnalysis_llmConfigId_idx" ON "CallAnalysis"("llmConfigId");

ALTER TABLE "CallAnalysis" ADD CONSTRAINT "CallAnalysis_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "prompt_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallAnalysis" ADD CONSTRAINT "CallAnalysis_llmConfigId_fkey" FOREIGN KEY ("llmConfigId") REFERENCES "llm_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
