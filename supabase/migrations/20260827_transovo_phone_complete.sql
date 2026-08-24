-- Transovo phone platform: employee links, call recordings, hold music settings, transfer codes

ALTER TABLE smart_routing_workspace_settings
  ADD COLUMN IF NOT EXISTS hold_music_slug TEXT DEFAULT 'hold-modern-corporate',
  ADD COLUMN IF NOT EXISTS hold_music_asset_id TEXT,
  ADD COLUMN IF NOT EXISTS hold_music_mode TEXT DEFAULT 'music',
  ADD COLUMN IF NOT EXISTS recording_enabled_inbound BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_enabled_outbound BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_transcription_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_summary_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_retention_days INTEGER DEFAULT 90,
  ADD COLUMN IF NOT EXISTS recording_announcement_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS employee_auth_mode TEXT DEFAULT 'remembered',
  ADD COLUMN IF NOT EXISTS transfer_dtmf_key TEXT DEFAULT '*2',
  ADD COLUMN IF NOT EXISTS conference_dtmf_key TEXT DEFAULT '*3';

ALTER TABLE smart_routing_destinations
  ADD COLUMN IF NOT EXISTS transfer_code TEXT,
  ADD COLUMN IF NOT EXISTS allow_transfer_to BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS transfer_whisper_label TEXT,
  ADD COLUMN IF NOT EXISTS on_business_call BOOLEAN DEFAULT false;

ALTER TABLE smart_routing_authorized_callers
  ADD COLUMN IF NOT EXISTS default_business_caller_id_e164 TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone_e164 TEXT;

CREATE TABLE IF NOT EXISTS smart_routing_employee_access_tokens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  authorized_caller_id TEXT NOT NULL REFERENCES smart_routing_authorized_callers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_employee_tokens_workspace
  ON smart_routing_employee_access_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sr_employee_tokens_caller
  ON smart_routing_employee_access_tokens(authorized_caller_id);

CREATE TABLE IF NOT EXISTS smart_routing_call_recordings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_session_id TEXT REFERENCES smart_routing_call_sessions(id) ON DELETE SET NULL,
  outbound_call_id TEXT REFERENCES smart_routing_outbound_calls(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'telnyx',
  provider_recording_id TEXT,
  storage_path TEXT,
  storage_bucket TEXT DEFAULT 'call-recordings',
  mime_type TEXT,
  duration_seconds INTEGER,
  direction TEXT,
  transcript_text TEXT,
  transcript_status TEXT DEFAULT 'pending',
  ai_summary TEXT,
  summary_status TEXT DEFAULT 'pending',
  retention_expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_call_recordings_workspace
  ON smart_routing_call_recordings(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sr_call_recordings_session
  ON smart_routing_call_recordings(call_session_id);

CREATE TABLE IF NOT EXISTS smart_routing_call_control_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_session_id TEXT NOT NULL REFERENCES smart_routing_call_sessions(id) ON DELETE CASCADE,
  employee_call_control_id TEXT NOT NULL,
  customer_call_control_id TEXT,
  control_state TEXT NOT NULL DEFAULT 'normal',
  transfer_path_json JSONB DEFAULT '[]',
  held_participant TEXT,
  consultation_call_control_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_call_control_session
  ON smart_routing_call_control_sessions(call_session_id);
