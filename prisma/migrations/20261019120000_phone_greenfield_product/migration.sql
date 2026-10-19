-- Phone product (new-app greenfield): HumanCall extensions, routing, power dialer, settings.

ALTER TABLE "human_calls" ADD COLUMN IF NOT EXISTS "phoneNumberId" TEXT;
ALTER TABLE "human_calls" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "human_calls" ADD COLUMN IF NOT EXISTS "handled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "human_calls" ADD COLUMN IF NOT EXISTS "callbackNeeded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "human_calls" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "human_calls" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "human_calls_workspaceId_handled_idx" ON "human_calls"("workspaceId", "handled");
CREATE INDEX IF NOT EXISTS "human_calls_phoneNumberId_idx" ON "human_calls"("phoneNumberId");

ALTER TABLE "workspace_phone_settings" ADD COLUMN IF NOT EXISTS "recordCalls" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "workspace_phone_settings" ADD COLUMN IF NOT EXISTS "transcribeVoicemail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "workspace_phone_settings" ADD COLUMN IF NOT EXISTS "noiseSuppression" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "workspace_phone_settings" ADD COLUMN IF NOT EXISTS "prefsJson" JSONB;
ALTER TABLE "workspace_phone_settings" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "human_call_notes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "humanCallId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "human_call_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "human_call_notes_humanCallId_createdAt_idx" ON "human_call_notes"("humanCallId", "createdAt");
ALTER TABLE "human_call_notes" ADD CONSTRAINT "human_call_notes_humanCallId_fkey" FOREIGN KEY ("humanCallId") REFERENCES "human_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "human_call_notes" ADD CONSTRAINT "human_call_notes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "workspace_call_routing" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "policyJson" JSONB NOT NULL,
    "greetingText" TEXT,
    "greetingUrl" TEXT,
    "providerSyncStatus" TEXT NOT NULL DEFAULT 'pending',
    "providerSyncError" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_call_routing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_call_routing_workspaceId_key" ON "workspace_call_routing"("workspaceId");
ALTER TABLE "workspace_call_routing" ADD CONSTRAINT "workspace_call_routing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "power_dialer_campaigns" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "listId" TEXT NOT NULL,
    "callerIdE164" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "totalContacts" INTEGER NOT NULL DEFAULT 0,
    "attemptedCount" INTEGER NOT NULL DEFAULT 0,
    "connectedCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_campaigns_workspaceId_status_idx" ON "power_dialer_campaigns"("workspaceId", "status");
ALTER TABLE "power_dialer_campaigns" ADD CONSTRAINT "power_dialer_campaigns_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_campaigns" ADD CONSTRAINT "power_dialer_campaigns_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "power_dialer_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "configJson" JSONB,
    CONSTRAINT "power_dialer_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_sessions_campaignId_status_idx" ON "power_dialer_sessions"("campaignId", "status");
ALTER TABLE "power_dialer_sessions" ADD CONSTRAINT "power_dialer_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_sessions" ADD CONSTRAINT "power_dialer_sessions_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "power_dialer_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "power_dialer_attempts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "humanCallId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "disposition" TEXT,
    "notes" TEXT,
    "callbackAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "power_dialer_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "power_dialer_attempts_humanCallId_key" ON "power_dialer_attempts"("humanCallId");
CREATE INDEX IF NOT EXISTS "power_dialer_attempts_sessionId_status_idx" ON "power_dialer_attempts"("sessionId", "status");
CREATE INDEX IF NOT EXISTS "power_dialer_attempts_contactId_idx" ON "power_dialer_attempts"("contactId");
ALTER TABLE "power_dialer_attempts" ADD CONSTRAINT "power_dialer_attempts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_attempts" ADD CONSTRAINT "power_dialer_attempts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "power_dialer_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_attempts" ADD CONSTRAINT "power_dialer_attempts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_attempts" ADD CONSTRAINT "power_dialer_attempts_humanCallId_fkey" FOREIGN KEY ("humanCallId") REFERENCES "human_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "telnyx_webhook_dedup" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telnyx_webhook_dedup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telnyx_webhook_dedup_eventId_key" ON "telnyx_webhook_dedup"("eventId");
CREATE INDEX IF NOT EXISTS "telnyx_webhook_dedup_processedAt_idx" ON "telnyx_webhook_dedup"("processedAt");
