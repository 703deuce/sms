-- Webhook signing + voice webhook deliveries + caller blocks
ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "signingSecretPrefix" TEXT;
ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "signingSecretHash" TEXT;
ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Webhook" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "voice_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "responseExcerpt" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_webhook_deliveries_eventId_key" ON "voice_webhook_deliveries"("eventId");
CREATE INDEX IF NOT EXISTS "voice_webhook_deliveries_webhookId_createdAt_idx" ON "voice_webhook_deliveries"("webhookId", "createdAt");
CREATE INDEX IF NOT EXISTS "voice_webhook_deliveries_workspaceId_status_idx" ON "voice_webhook_deliveries"("workspaceId", "status");

ALTER TABLE "voice_webhook_deliveries" ADD CONSTRAINT "voice_webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_webhook_deliveries" ADD CONSTRAINT "voice_webhook_deliveries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "voice_caller_blocks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callerE164" TEXT NOT NULL,
    "reason" TEXT,
    "sourceCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_caller_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_caller_blocks_workspaceId_callerE164_key" ON "voice_caller_blocks"("workspaceId", "callerE164");
CREATE INDEX IF NOT EXISTS "voice_caller_blocks_workspaceId_idx" ON "voice_caller_blocks"("workspaceId");

ALTER TABLE "voice_caller_blocks" ADD CONSTRAINT "voice_caller_blocks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
