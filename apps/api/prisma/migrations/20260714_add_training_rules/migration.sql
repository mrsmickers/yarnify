-- CreateTable
CREATE TABLE "training_rules" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "training_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_rules_category_idx" ON "training_rules"("category");

-- CreateIndex
CREATE INDEX "training_rules_isActive_idx" ON "training_rules"("isActive");

-- CreateIndex
CREATE INDEX "training_rules_department_idx" ON "training_rules"("department");

-- Seed default training rules
INSERT INTO "training_rules" ("id", "title", "description", "category", "department", "isActive", "isCritical", "sortOrder", "createdAt", "updatedAt")
VALUES
    ('seed_rule_1', 'No understaffing disclosure', 'Never tell the customer that the team is understaffed, short-handed, or that you''re too busy. Instead, focus on helping them and providing a resolution.', 'compliance', NULL, true, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('seed_rule_2', 'Customer name usage', 'Use the customer''s name at least twice during the call to personalise the interaction.', 'customer_service', NULL, true, false, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('seed_rule_3', 'Callback offer', 'If the issue cannot be resolved immediately, always offer to call the customer back with an update rather than leaving them waiting.', 'customer_service', NULL, true, false, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
