-- Smart Routing standalone product V1 — workspace settings, authorized callers, outbound audit

CREATE TABLE IF NOT EXISTS smart_routing_workspace_settings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  public_business_e164 TEXT,
  routing_number_e164 TEXT,
  assigned_phone_number_id TEXT,
  routing_mode TEXT NOT NULL DEFAULT 'front_door',
  caller_id_status TEXT NOT NULL DEFAULT 'not_verified',
  caller_id_provider TEXT DEFAULT 'telnyx',
  caller_id_provider_ref TEXT,
  caller_id_method TEXT,
  caller_id_verified_at TIMESTAMPTZ,
  caller_id_failed_reason TEXT,
  caller_id_requested_at TIMESTAMPTZ,
  outbound_enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_override_json JSONB,
  setup_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smart_routing_authorized_callers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  outbound_enabled BOOLEAN NOT NULL DEFAULT true,
  user_id TEXT,
  failed_pin_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, phone_e164)
);

CREATE INDEX IF NOT EXISTS smart_routing_authorized_callers_workspace_idx
  ON smart_routing_authorized_callers (workspace_id, active);

CREATE TABLE IF NOT EXISTS smart_routing_access_sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_control_id TEXT NOT NULL,
  caller_number TEXT NOT NULL,
  called_number TEXT NOT NULL,
  authorized_caller_id TEXT,
  state TEXT NOT NULL DEFAULT 'pin_entry',
  pin_attempts INT NOT NULL DEFAULT 0,
  pending_destination TEXT,
  context_type TEXT,
  context_ref_id TEXT,
  customer_call_control_id TEXT,
  state_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_routing_access_sessions_call_control_idx
  ON smart_routing_access_sessions (call_control_id);

CREATE TABLE IF NOT EXISTS smart_routing_outbound_calls (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  authorized_caller_id TEXT REFERENCES smart_routing_authorized_callers(id) ON DELETE SET NULL,
  employee_phone_e164 TEXT NOT NULL,
  destination_e164 TEXT NOT NULL,
  business_caller_id_e164 TEXT,
  context_type TEXT NOT NULL,
  context_ref_id TEXT,
  provider TEXT NOT NULL DEFAULT 'telnyx',
  employee_call_control_id TEXT,
  customer_call_control_id TEXT,
  employee_leg_started_at TIMESTAMPTZ,
  customer_leg_started_at TIMESTAMPTZ,
  bridged_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  result TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_routing_outbound_calls_workspace_idx
  ON smart_routing_outbound_calls (workspace_id, created_at);
