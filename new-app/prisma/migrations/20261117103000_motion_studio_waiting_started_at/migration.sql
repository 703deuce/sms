-- Separate customer response deadline from checkpoint and telemetry update timestamps.
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "waitingStartedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "MotionStudioAgentJob_status_waitingStartedAt_idx"
 ON "MotionStudioAgentJob" ("status", "waitingStartedAt");
