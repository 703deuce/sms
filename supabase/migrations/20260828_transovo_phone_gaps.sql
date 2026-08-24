-- Temporary callback codes for employee PIN bypass

CREATE TABLE IF NOT EXISTS smart_routing_callback_codes (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  authorized_caller_id TEXT NOT NULL REFERENCES smart_routing_authorized_callers(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_callback_codes_workspace
  ON smart_routing_callback_codes(workspace_id, authorized_caller_id);
CREATE INDEX IF NOT EXISTS idx_sr_callback_codes_expires
  ON smart_routing_callback_codes(expires_at);
