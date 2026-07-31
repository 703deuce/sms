-- Finish gaps: messaging settings, email-to-SMS, payment links

CREATE TABLE IF NOT EXISTS "workspace_messaging_settings" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "businessHoursJson" JSONB,
  "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  "awayMessage" TEXT,
  "awayEnabled" BOOLEAN NOT NULL DEFAULT false,
  "awayAlways" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "workspace_messaging_settings_workspaceId_idx" ON "workspace_messaging_settings"("workspaceId");

CREATE TABLE IF NOT EXISTS "email_to_sms_addresses" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "localPart" TEXT NOT NULL,
  "phoneE164" TEXT,
  "fromNumber" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspaceId", "localPart")
);
CREATE INDEX IF NOT EXISTS "email_to_sms_addresses_workspaceId_active_idx" ON "email_to_sms_addresses"("workspaceId", "active");

CREATE TYPE "PaymentLinkStatus" AS ENUM ('pending', 'paid', 'expired', 'canceled');

CREATE TABLE IF NOT EXISTS "payment_links" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "contactId" TEXT,
  "phone" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "description" TEXT,
  "stripeSessionId" TEXT,
  "status" "PaymentLinkStatus" NOT NULL DEFAULT 'pending',
  "url" TEXT NOT NULL,
  "campaignId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "payment_links_workspaceId_status_idx" ON "payment_links"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "payment_links_stripeSessionId_idx" ON "payment_links"("stripeSessionId");

-- Human softphone, push subscriptions, workspace settings prefs

CREATE TABLE IF NOT EXISTS "human_calls" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'outbound',
  "status" TEXT NOT NULL DEFAULT 'initiated',
  "agentUserId" TEXT,
  "telnyxCallControlId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "recordingUrl" TEXT,
  "notes" TEXT,
  "disposition" TEXT,
  "muted" BOOLEAN NOT NULL DEFAULT false,
  "onHold" BOOLEAN NOT NULL DEFAULT false,
  "callerIdNumber" TEXT
);
CREATE INDEX IF NOT EXISTS "human_calls_workspaceId_startedAt_idx" ON "human_calls"("workspaceId", "startedAt");
CREATE INDEX IF NOT EXISTS "human_calls_telnyxCallControlId_idx" ON "human_calls"("telnyxCallControlId");

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "endpoint")
);
CREATE INDEX IF NOT EXISTS "push_subscriptions_workspaceId_userId_idx" ON "push_subscriptions"("workspaceId", "userId");

CREATE TABLE IF NOT EXISTS "workspace_notification_prefs" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "notifyEmail" TEXT,
  "digestFrequency" TEXT NOT NULL DEFAULT 'daily',
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "prefs" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("workspaceId", "userId")
);

CREATE TABLE IF NOT EXISTS "workspace_limits" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "limits" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "workspace_data_prefs" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "messageRetentionDays" INTEGER NOT NULL DEFAULT 365,
  "consentRetention" TEXT NOT NULL DEFAULT 'forever',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "workspace_phone_settings" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "defaultCallerIdNumber" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "credit_ledger_entries" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "amountCents" INTEGER NOT NULL,
  "balanceAfterCents" INTEGER,
  "description" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'adjustment',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "credit_ledger_entries_workspaceId_createdAt_idx" ON "credit_ledger_entries"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "sender_pools" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "phoneNumberIds" TEXT[] NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sender_pools_workspaceId_idx" ON "sender_pools"("workspaceId");
