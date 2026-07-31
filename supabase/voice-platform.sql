-- Voice AI platform tables (additive, safe on existing DBs)
-- Run: npx prisma db execute --schema prisma/schema.prisma --file supabase/voice-platform.sql

CREATE TYPE "VoiceAgentStatus" AS ENUM ('DRAFT', 'TESTING', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'CONFIGURATION_ERROR');
CREATE TYPE "VoiceCallDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "VoiceCallStatus" AS ENUM ('QUEUED', 'INITIATED', 'RINGING', 'ANSWERED', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELLED', 'VOICEMAIL', 'TRANSFERRED');
CREATE TYPE "VoiceCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

CREATE TABLE IF NOT EXISTS "voice_agents" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "agentType" text NOT NULL DEFAULT 'custom',
  "status" "VoiceAgentStatus" NOT NULL DEFAULT 'DRAFT',
  "displayName" text,
  "purpose" text,
  "phoneNumberId" text,
  "directions" text[] DEFAULT ARRAY['inbound','outbound'],
  "draftConfig" jsonb,
  "publishedVersionId" text,
  "telnyxAssistantId" text,
  "telnyxConnectionId" text,
  "callsHandled" integer NOT NULL DEFAULT 0,
  "conversionRate" double precision NOT NULL DEFAULT 0,
  "healthStatus" text NOT NULL DEFAULT 'ok',
  "healthMessage" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "archivedAt" timestamptz
);
CREATE INDEX IF NOT EXISTS "voice_agents_workspaceId_status_idx" ON "voice_agents" ("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "voice_agent_versions" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text NOT NULL REFERENCES "voice_agents"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "config" jsonb NOT NULL,
  "changeLog" text,
  "publishedAt" timestamptz NOT NULL DEFAULT now(),
  "publishedBy" text,
  UNIQUE ("agentId", "version")
);

CREATE TABLE IF NOT EXISTS "voice_calls" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "agentVersionId" text REFERENCES "voice_agent_versions"("id") ON DELETE SET NULL,
  "contactId" text,
  "campaignId" text,
  "direction" "VoiceCallDirection" NOT NULL,
  "status" "VoiceCallStatus" NOT NULL DEFAULT 'QUEUED',
  "outcome" text,
  "fromE164" text NOT NULL,
  "toE164" text NOT NULL,
  "phoneNumberId" text,
  "isTest" boolean NOT NULL DEFAULT false,
  "leadScore" integer,
  "appointmentBooked" boolean NOT NULL DEFAULT false,
  "transferred" boolean NOT NULL DEFAULT false,
  "voicemailDetected" boolean NOT NULL DEFAULT false,
  "durationSeconds" integer,
  "costCents" integer NOT NULL DEFAULT 0,
  "providerCostCents" integer NOT NULL DEFAULT 0,
  "aiMinutes" double precision NOT NULL DEFAULT 0,
  "telnyxCallControlId" text,
  "telnyxConversationId" text,
  "telnyxCallSessionId" text,
  "dynamicVariables" jsonb,
  "metadata" jsonb,
  "errorMessage" text,
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "answeredAt" timestamptz,
  "endedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_calls_workspaceId_startedAt_idx" ON "voice_calls" ("workspaceId", "startedAt");
CREATE INDEX IF NOT EXISTS "voice_calls_telnyxCallControlId_idx" ON "voice_calls" ("telnyxCallControlId");

CREATE TABLE IF NOT EXISTS "voice_campaigns" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text NOT NULL REFERENCES "voice_agents"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "status" "VoiceCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "callerIdNumberId" text,
  "audienceType" text NOT NULL DEFAULT 'list',
  "audienceConfig" jsonb,
  "scheduleConfig" jsonb,
  "callingRules" jsonb,
  "voicemailRules" jsonb,
  "followUpActions" jsonb,
  "concurrency" integer NOT NULL DEFAULT 1,
  "dailyLimit" integer,
  "maxAttempts" integer NOT NULL DEFAULT 3,
  "timezone" text,
  "totalContacts" integer NOT NULL DEFAULT 0,
  "completedCount" integer NOT NULL DEFAULT 0,
  "qualifiedCount" integer NOT NULL DEFAULT 0,
  "startedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "voice_knowledge_bases" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "voice_tools" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "toolType" text NOT NULL,
  "config" jsonb NOT NULL,
  "inputSchema" jsonb,
  "outputSchema" jsonb,
  "secretRef" text,
  "timeoutMs" integer NOT NULL DEFAULT 30000,
  "retryPolicy" jsonb,
  "isAsync" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "provider_webhook_events" (
  "id" text PRIMARY KEY,
  "workspaceId" text REFERENCES "Workspace"("id") ON DELETE SET NULL,
  "provider" text NOT NULL DEFAULT 'telnyx',
  "eventType" text NOT NULL,
  "providerEventId" text NOT NULL UNIQUE,
  "payload" jsonb,
  "status" text NOT NULL DEFAULT 'received',
  "errorMessage" text,
  "processedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS "UsageRecord"
  ADD COLUMN IF NOT EXISTS "voiceMinutes" double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aiMinutes" double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "voiceCostCents" integer NOT NULL DEFAULT 0;
