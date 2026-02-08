-- AlterTable
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "callDirection" TEXT;
ALTER TABLE "Call" ADD COLUMN IF NOT EXISTS "externalPhoneNumber" TEXT;
