-- CRM integration tables (additive, safe on existing DBs)
-- Preferred path (applies entire prisma/schema.prisma, including these tables):
--   npm run db:push
-- Fallback SQL path (this file only):
--   npx prisma db execute --schema prisma/schema.prisma --file supabase/crm-integration.sql
-- Then refresh PostgREST if needed:
--   NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- IntegrationConnection CRM metadata columns
-- ---------------------------------------------------------------------------
ALTER TABLE "integration_connections"
  ADD COLUMN IF NOT EXISTS "connectedUserId" text;
ALTER TABLE "integration_connections"
  ADD COLUMN IF NOT EXISTS "connectedAccountName" text;
ALTER TABLE "integration_connections"
  ADD COLUMN IF NOT EXISTS "syncStatus" text NOT NULL DEFAULT 'idle';

-- ---------------------------------------------------------------------------
-- Job queue priority (CRM / sync workers)
-- ---------------------------------------------------------------------------
ALTER TABLE "job_queue"
  ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 50;
CREATE INDEX IF NOT EXISTS "job_queue_status_priority_runAfter_queueName_idx"
  ON "job_queue" ("status", "priority", "runAfter", "queueName");

-- ---------------------------------------------------------------------------
-- CRM object mappings (enterprise sync columns included)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "crm_object_mappings" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "objectType" text NOT NULL,
  "internalId" text NOT NULL,
  "externalId" text NOT NULL,
  "externalUrl" text,
  "parentExternalId" text,
  "fingerprint" text,
  "syncHash" text,
  "syncVersion" integer NOT NULL DEFAULT 1,
  "syncStatus" text NOT NULL DEFAULT 'synced',
  "lastSyncedAt" timestamptz,
  "lastCrmModifiedAt" timestamptz,
  "lastInternalModifiedAt" timestamptz,
  "externalDeletedAt" timestamptz,
  "syncDirection" text NOT NULL DEFAULT 'bidirectional',
  "metadataJson" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

-- Enterprise columns if an older skinny table already exists
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "parentExternalId" text;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "syncHash" text;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "syncVersion" integer NOT NULL DEFAULT 1;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "syncStatus" text NOT NULL DEFAULT 'synced';
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "lastCrmModifiedAt" timestamptz;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "lastInternalModifiedAt" timestamptz;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "externalDeletedAt" timestamptz;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "syncDirection" text NOT NULL DEFAULT 'bidirectional';
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "metadataJson" jsonb;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "externalUrl" text;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "fingerprint" text;
ALTER TABLE "crm_object_mappings" ADD COLUMN IF NOT EXISTS "lastSyncedAt" timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_objectType_internalId_key"
  ON "crm_object_mappings" ("workspaceId", "provider", "objectType", "internalId");
CREATE UNIQUE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_objectType_externalId_key"
  ON "crm_object_mappings" ("workspaceId", "provider", "objectType", "externalId");
CREATE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_fingerprint_idx"
  ON "crm_object_mappings" ("workspaceId", "provider", "fingerprint");
CREATE INDEX IF NOT EXISTS "crm_object_mappings_workspaceId_provider_objectType_syncStatus_idx"
  ON "crm_object_mappings" ("workspaceId", "provider", "objectType", "syncStatus");

-- ---------------------------------------------------------------------------
-- Field mappings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "crm_field_mappings" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "objectType" text NOT NULL,
  "internalField" text NOT NULL,
  "externalField" text NOT NULL,
  "transform" text,
  "direction" text NOT NULL DEFAULT 'bidirectional',
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "crm_field_mappings_workspaceId_provider_objectType_internalField_direction_key"
  ON "crm_field_mappings" ("workspaceId", "provider", "objectType", "internalField", "direction");
CREATE INDEX IF NOT EXISTS "crm_field_mappings_workspaceId_provider_idx"
  ON "crm_field_mappings" ("workspaceId", "provider");

-- ---------------------------------------------------------------------------
-- Sync runs + events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "crm_sync_runs" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "kind" text NOT NULL,
  "direction" text NOT NULL DEFAULT 'bidirectional',
  "status" text NOT NULL DEFAULT 'queued',
  "objectType" text,
  "startedAt" timestamptz,
  "finishedAt" timestamptz,
  "durationMs" integer,
  "attempts" integer NOT NULL DEFAULT 0,
  "statsJson" jsonb,
  "lastError" text,
  "cursorJson" jsonb,
  "triggeredBy" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "crm_sync_runs_workspaceId_provider_createdAt_idx"
  ON "crm_sync_runs" ("workspaceId", "provider", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_sync_runs_status_createdAt_idx"
  ON "crm_sync_runs" ("status", "createdAt");

CREATE TABLE IF NOT EXISTS "crm_sync_events" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "syncRunId" text NOT NULL REFERENCES "crm_sync_runs"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "level" text NOT NULL DEFAULT 'info',
  "action" text NOT NULL,
  "objectType" text,
  "internalId" text,
  "externalId" text,
  "message" text NOT NULL,
  "detailJson" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "crm_sync_events_syncRunId_createdAt_idx"
  ON "crm_sync_events" ("syncRunId", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_sync_events_workspaceId_provider_createdAt_idx"
  ON "crm_sync_events" ("workspaceId", "provider", "createdAt");

-- ---------------------------------------------------------------------------
-- Audit / webhooks / dead letters
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "crm_audit_logs" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "provider" text,
  "category" text NOT NULL,
  "action" text NOT NULL,
  "message" text NOT NULL,
  "detailJson" jsonb,
  "actorUserId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "crm_audit_logs_workspaceId_createdAt_idx"
  ON "crm_audit_logs" ("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_audit_logs_workspaceId_provider_createdAt_idx"
  ON "crm_audit_logs" ("workspaceId", "provider", "createdAt");

CREATE TABLE IF NOT EXISTS "crm_webhook_events" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "eventType" text,
  "externalId" text,
  "payloadJson" jsonb NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "lastError" text,
  "processedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "crm_webhook_events_workspaceId_provider_status_createdAt_idx"
  ON "crm_webhook_events" ("workspaceId", "provider", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "crm_dead_letters" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "jobType" text NOT NULL,
  "objectType" text,
  "internalId" text,
  "externalId" text,
  "payloadJson" jsonb,
  "error" text NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "syncRunId" text,
  "resolvedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "crm_dead_letters_workspaceId_provider_createdAt_idx"
  ON "crm_dead_letters" ("workspaceId", "provider", "createdAt");
CREATE INDEX IF NOT EXISTS "crm_dead_letters_resolvedAt_idx"
  ON "crm_dead_letters" ("resolvedAt");

NOTIFY pgrst, 'reload schema';
