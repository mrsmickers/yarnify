-- Add transfer/grouping fields to Call table
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "callerIdInternal" TEXT;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "callGroupId" TEXT;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "callLegOrder" INTEGER;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "destinationType" TEXT;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "sourceNumber" TEXT;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "destinationNumber" TEXT;

-- Create indexes for efficient grouping queries
CREATE INDEX IF NOT EXISTS "Call_callerIdInternal_idx" ON "Call"("callerIdInternal");
CREATE INDEX IF NOT EXISTS "Call_callGroupId_idx" ON "Call"("callGroupId");
