-- Add transfer agent fields to Call table
ALTER TABLE "Call" ADD COLUMN "transferredToAgentId" TEXT;
ALTER TABLE "Call" ADD COLUMN "transferDetectedAt" TIMESTAMP(3);
ALTER TABLE "Call" ADD COLUMN "transferNote" TEXT;

-- Add foreign key constraint
ALTER TABLE "Call" ADD CONSTRAINT "Call_transferredToAgentId_fkey" FOREIGN KEY ("transferredToAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for efficient lookups
CREATE INDEX "Call_transferredToAgentId_idx" ON "Call"("transferredToAgentId");
