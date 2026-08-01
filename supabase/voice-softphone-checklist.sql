-- Additive schema for AI Voice RAG + Softphone checklist features
-- Prefer: npm run db:push  (Prisma is source of truth)
-- This SQL is an emergency fallback for production without migrate.
-- Column names match Prisma (camelCase, quoted).

ALTER TABLE "voice_knowledge_bases"
  ADD COLUMN IF NOT EXISTS "telnyxBucketName" text,
  ADD COLUMN IF NOT EXISTS "telnyxEmbeddingStatus" text,
  ADD COLUMN IF NOT EXISTS "telnyxEmbeddingTaskId" text,
  ADD COLUMN IF NOT EXISTS "lastEmbeddedAt" timestamptz;

ALTER TABLE "voice_knowledge_sources"
  ADD COLUMN IF NOT EXISTS "telnyxObjectKey" text;

ALTER TABLE "call_queues"
  ADD COLUMN IF NOT EXISTS "maxWaitSeconds" integer DEFAULT 300,
  ADD COLUMN IF NOT EXISTS "holdMusicUrl" text,
  ADD COLUMN IF NOT EXISTS "announcementUrl" text,
  ADD COLUMN IF NOT EXISTS "callbackEnabled" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "configJson" jsonb;

ALTER TABLE "human_calls"
  ADD COLUMN IF NOT EXISTS "telnyxCallLegId" text,
  ADD COLUMN IF NOT EXISTS "conferenceId" text,
  ADD COLUMN IF NOT EXISTS "parkSlotId" text,
  ADD COLUMN IF NOT EXISTS "queueId" text,
  ADD COLUMN IF NOT EXISTS "contactId" text,
  ADD COLUMN IF NOT EXISTS "recordingStartedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "transcriptText" text,
  ADD COLUMN IF NOT EXISTS "aiSummary" text,
  ADD COLUMN IF NOT EXISTS "answeredAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "mediaMode" text DEFAULT 'call_control';

CREATE TABLE IF NOT EXISTS "call_park_slots" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "slotCode" text NOT NULL,
  "humanCallId" text,
  "telnyxCallControlId" text,
  "parkedByUserId" text,
  "status" text NOT NULL DEFAULT 'available',
  "parkedAt" timestamptz,
  "timeoutAt" timestamptz,
  "fallbackTarget" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE("workspaceId", "slotCode")
);

CREATE TABLE IF NOT EXISTS "conference_calls" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" text,
  "telnyxConferenceId" text,
  "hostUserId" text,
  "hostHumanCallId" text,
  "status" text NOT NULL DEFAULT 'active',
  "recordingUrl" text,
  "startedAt" timestamptz NOT NULL DEFAULT NOW(),
  "endedAt" timestamptz
);

CREATE TABLE IF NOT EXISTS "conference_participants" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "conferenceId" text NOT NULL REFERENCES "conference_calls"("id") ON DELETE CASCADE,
  "humanCallId" text,
  "telnyxCallControlId" text,
  "displayName" text,
  "role" text NOT NULL DEFAULT 'participant',
  "status" text NOT NULL DEFAULT 'joined',
  "muted" boolean NOT NULL DEFAULT false,
  "onHold" boolean NOT NULL DEFAULT false,
  "joinedAt" timestamptz NOT NULL DEFAULT NOW(),
  "leftAt" timestamptz
);

CREATE TABLE IF NOT EXISTS "voicemail_boxes" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "ownerUserId" text,
  "queueId" text,
  "phoneNumberId" text,
  "greetingText" text,
  "greetingUrl" text,
  "afterHoursGreetingUrl" text,
  "emailNotify" text,
  "transcriptionEnabled" boolean NOT NULL DEFAULT true,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "voicemail_messages" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "boxId" text NOT NULL REFERENCES "voicemail_boxes"("id") ON DELETE CASCADE,
  "fromE164" text,
  "toE164" text,
  "recordingUrl" text,
  "durationSeconds" integer,
  "transcriptText" text,
  "isRead" boolean NOT NULL DEFAULT false,
  "forwardedTo" text,
  "humanCallId" text,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "call_forwarding_rules" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" text,
  "phoneNumberId" text,
  "mode" text NOT NULL,
  "targetType" text NOT NULL,
  "targetValue" text NOT NULL,
  "ringSeconds" integer NOT NULL DEFAULT 25,
  "priority" integer NOT NULL DEFAULT 100,
  "active" boolean NOT NULL DEFAULT true,
  "configJson" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "softphone_presence" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" text NOT NULL,
  "status" text NOT NULL DEFAULT 'available',
  "customLabel" text,
  "queueAvailable" boolean NOT NULL DEFAULT true,
  "deviceIds" text[] NOT NULL DEFAULT '{}',
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE("workspaceId", "userId")
);

CREATE TABLE IF NOT EXISTS "softphone_user_settings" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "userId" text NOT NULL,
  "extension" text,
  "defaultCallerId" text,
  "ringDesktop" boolean NOT NULL DEFAULT true,
  "ringMobile" boolean NOT NULL DEFAULT true,
  "forwardToCellular" text,
  "dndEnabled" boolean NOT NULL DEFAULT false,
  "e911AddressJson" jsonb,
  "permissionsJson" jsonb,
  "recordingEnabled" boolean NOT NULL DEFAULT true,
  "internationalEnabled" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT NOW(),
  "updatedAt" timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE("workspaceId", "userId")
);

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "timezone" text;

CREATE TABLE IF NOT EXISTS "human_call_events" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "humanCallId" text NOT NULL REFERENCES "human_calls"("id") ON DELETE CASCADE,
  "eventType" text NOT NULL,
  "payload" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "human_call_events_humanCallId_createdAt_idx"
  ON "human_call_events" ("humanCallId", "createdAt");
CREATE INDEX IF NOT EXISTS "human_call_events_workspaceId_createdAt_idx"
  ON "human_call_events" ("workspaceId", "createdAt");
