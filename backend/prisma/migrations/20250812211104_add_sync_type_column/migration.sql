-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "lastSyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sync_jobs" ADD COLUMN     "syncType" TEXT;

-- Update existing records with default value
UPDATE "sync_jobs" SET "syncType" = 'full' WHERE "syncType" IS NULL;

-- Make the column NOT NULL after updating existing records
ALTER TABLE "sync_jobs" ALTER COLUMN "syncType" SET NOT NULL;
