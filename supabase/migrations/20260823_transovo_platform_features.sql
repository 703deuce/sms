-- Transovo platform product features, callback requests, MCTB template extensions
-- Column names match Prisma @@map models (camelCase), not snake_case.

DO $$ BEGIN
  CREATE TYPE "WorkspaceProductFeatureKey" AS ENUM (
    'MCTB',
    'SMART_ROUTING',
    'VISUAL_VOICEMAIL',
    'CALLBACK_REQUESTS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS workspace_product_features (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "featureKey" "WorkspaceProductFeatureKey" NOT NULL,
  status "ProductAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMPTZ,
  "deactivatedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("workspaceId", "featureKey")
);

CREATE INDEX IF NOT EXISTS workspace_product_features_workspace_id_idx
  ON workspace_product_features ("workspaceId");
CREATE INDEX IF NOT EXISTS workspace_product_features_feature_key_status_idx
  ON workspace_product_features ("featureKey", status);

CREATE TABLE IF NOT EXISTS callback_requests (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "callerE164" TEXT NOT NULL,
  "businessE164" TEXT,
  "phoneNumberId" TEXT,
  "smartRoutingSessionId" TEXT,
  "sourceRoute" TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "contactedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "dismissedAt" TIMESTAMPTZ,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS callback_requests_workspace_status_idx
  ON callback_requests ("workspaceId", status, "requestedAt");
CREATE INDEX IF NOT EXISTS callback_requests_workspace_caller_idx
  ON callback_requests ("workspaceId", "callerE164");

ALTER TABLE missed_call_text_configs
  ADD COLUMN IF NOT EXISTS "messageTemplateBusinessHours" TEXT,
  ADD COLUMN IF NOT EXISTS "messageTemplateAfterHours" TEXT,
  ADD COLUMN IF NOT EXISTS "requireCarrierForward" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE voicemail_messages
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "isResolved" BOOLEAN NOT NULL DEFAULT false;
