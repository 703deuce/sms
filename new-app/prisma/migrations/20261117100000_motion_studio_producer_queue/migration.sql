-- Pull-based producer queue. Durable jobs and expiring claims survive worker restarts.
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "leaseOwner" TEXT;
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "leaseIdHash" TEXT;
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "leaseAttempts" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "MotionStudioAgentJob_status_leaseExpiresAt_createdAt_idx"
 ON "MotionStudioAgentJob" ("status", "leaseExpiresAt", "createdAt");
