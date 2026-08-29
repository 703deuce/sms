-- Messaging delivery tracking: provider status, errors, timestamps, failed aggregates

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "failed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "providerStatus" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "providerErrorCode" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "failureCategory" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMPTZ;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMPTZ;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "providerStatus" TEXT;
ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "providerErrorCode" TEXT;
ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "failureCategory" TEXT;
ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMPTZ;
ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMPTZ;
ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "failedCounted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "campaign_messages_workspaceId_status_idx"
  ON "campaign_messages" ("workspaceId", "status");

CREATE INDEX IF NOT EXISTS "campaign_messages_failureCategory_idx"
  ON "campaign_messages" ("failureCategory")
  WHERE "failureCategory" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Message_workspaceId_status_createdAt_idx"
  ON "Message" ("workspaceId", "status", "createdAt");
