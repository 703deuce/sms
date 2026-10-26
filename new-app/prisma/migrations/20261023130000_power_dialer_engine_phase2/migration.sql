-- Power Dialer Phase 2: campaign rules, session progression, attempt lifecycle

ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "ringTimeoutSeconds" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "retryIntervalMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "dailyAttemptCap" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "totalAttemptCap" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "postCallIntervalSeconds" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "requireDispositionBeforeNext" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "allowedDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5]';
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "callingHoursStart" TEXT NOT NULL DEFAULT '09:00';
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "callingHoursEnd" TEXT NOT NULL DEFAULT '17:00';
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "phoneFieldPriority" JSONB NOT NULL DEFAULT '["phone"]';
ALTER TABLE "power_dialer_campaigns" ADD COLUMN IF NOT EXISTS "dialingMode" TEXT NOT NULL DEFAULT 'power';

ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "currentAttemptId" TEXT;
ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "nextCallAt" TIMESTAMP(3);
ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "progressionPhase" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "progressJson" JSONB;
ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "repUserId" TEXT;
ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "dialSequence" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "sequenceNumber" INTEGER;
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "answerClassification" TEXT;
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "dialedAt" TIMESTAMP(3);
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "ringingAt" TIMESTAMP(3);
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "answeredAt" TIMESTAMP(3);
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "billableSeconds" INTEGER;
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "ringTimeoutAt" TIMESTAMP(3);
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "dispositionEffectsAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "power_dialer_attempts_idempotencyKey_key" ON "power_dialer_attempts"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "power_dialer_attempts_sessionId_sequenceNumber_key" ON "power_dialer_attempts"("sessionId", "sequenceNumber");
