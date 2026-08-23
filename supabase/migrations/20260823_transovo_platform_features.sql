-- Transovo platform product features, callback requests, MCTB template extensions

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
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  feature_key "WorkspaceProductFeatureKey" NOT NULL,
  status "ProductAccessStatus" NOT NULL DEFAULT 'ACTIVE',
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, feature_key)
);

CREATE INDEX IF NOT EXISTS workspace_product_features_workspace_id_idx
  ON workspace_product_features (workspace_id);
CREATE INDEX IF NOT EXISTS workspace_product_features_feature_key_status_idx
  ON workspace_product_features (feature_key, status);

CREATE TABLE IF NOT EXISTS callback_requests (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  caller_e164 TEXT NOT NULL,
  business_e164 TEXT,
  phone_number_id TEXT,
  smart_routing_session_id TEXT,
  source_route TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contacted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS callback_requests_workspace_status_idx
  ON callback_requests (workspace_id, status, requested_at);
CREATE INDEX IF NOT EXISTS callback_requests_workspace_caller_idx
  ON callback_requests (workspace_id, caller_e164);

ALTER TABLE missed_call_text_configs
  ADD COLUMN IF NOT EXISTS message_template_business_hours TEXT,
  ADD COLUMN IF NOT EXISTS message_template_after_hours TEXT,
  ADD COLUMN IF NOT EXISTS require_carrier_forward BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE voicemail_messages
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN NOT NULL DEFAULT false;
