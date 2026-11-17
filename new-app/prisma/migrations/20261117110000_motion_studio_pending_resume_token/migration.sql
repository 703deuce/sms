-- Stage a fresh answer-resume token while retaining the current job credential.
-- Only promote after the producer accepts the answer webhook.
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "pendingTokenHash" TEXT;
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "pendingTokenExpiresAt" TIMESTAMP(3);
