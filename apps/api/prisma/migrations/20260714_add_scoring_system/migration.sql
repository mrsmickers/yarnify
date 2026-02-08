-- Add weight field to training_rules
ALTER TABLE "training_rules" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 10;

-- Create scoring_categories table
CREATE TABLE "scoring_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_categories_pkey" PRIMARY KEY ("id")
);

-- Create unique index on scoring_categories.name
CREATE UNIQUE INDEX "scoring_categories_name_key" ON "scoring_categories"("name");

-- Create training_rule_evaluations table
CREATE TABLE "training_rule_evaluations" (
    "id" TEXT NOT NULL,
    "callAnalysisId" TEXT NOT NULL,
    "trainingRuleId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "reasoning" TEXT,
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_rule_evaluations_pkey" PRIMARY KEY ("id")
);

-- Create indexes on training_rule_evaluations
CREATE INDEX "training_rule_evaluations_callAnalysisId_idx" ON "training_rule_evaluations"("callAnalysisId");
CREATE INDEX "training_rule_evaluations_trainingRuleId_idx" ON "training_rule_evaluations"("trainingRuleId");
CREATE UNIQUE INDEX "training_rule_evaluations_callAnalysisId_trainingRuleId_key" ON "training_rule_evaluations"("callAnalysisId", "trainingRuleId");

-- Add foreign keys
ALTER TABLE "training_rule_evaluations" ADD CONSTRAINT "training_rule_evaluations_callAnalysisId_fkey" FOREIGN KEY ("callAnalysisId") REFERENCES "CallAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_rule_evaluations" ADD CONSTRAINT "training_rule_evaluations_trainingRuleId_fkey" FOREIGN KEY ("trainingRuleId") REFERENCES "training_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default scoring categories
INSERT INTO scoring_categories (id, name, label, weight, "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES 
  ('cat-compliance', 'compliance', 'Compliance', 30, true, 1, NOW(), NOW()),
  ('cat-customer-service', 'customer_service', 'Customer Service', 40, true, 2, NOW(), NOW()),
  ('cat-sales', 'sales', 'Sales & Resolution', 30, true, 3, NOW(), NOW())
ON CONFLICT DO NOTHING;
