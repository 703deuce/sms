-- Appointment workflows (isolated from drip_campaigns / SMS playbooks)

CREATE TABLE IF NOT EXISTS appointment_workflows (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'custom',
  template_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active',
  trigger TEXT NOT NULL,
  appointment_type_scope JSONB NOT NULL DEFAULT '{}',
  channels JSONB NOT NULL DEFAULT '[]',
  conditions JSONB,
  steps_json JSONB NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_workflows_workspace_status_idx
  ON appointment_workflows (workspace_id, status);
CREATE INDEX IF NOT EXISTS appointment_workflows_workspace_trigger_idx
  ON appointment_workflows (workspace_id, trigger);

CREATE TABLE IF NOT EXISTS appointment_workflow_executions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL REFERENCES appointment_workflows(id) ON DELETE CASCADE,
  workflow_version INTEGER NOT NULL DEFAULT 1,
  appointment_id TEXT NOT NULL,
  contact_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  invalidate_reason TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS appointment_workflow_executions_ws_appt_idx
  ON appointment_workflow_executions (workspace_id, appointment_id);
CREATE INDEX IF NOT EXISTS appointment_workflow_executions_wf_status_idx
  ON appointment_workflow_executions (workflow_id, status);

CREATE TABLE IF NOT EXISTS appointment_workflow_step_executions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  execution_id TEXT NOT NULL REFERENCES appointment_workflow_executions(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'scheduled',
  channel TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_message_id TEXT,
  failure_reason TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_workflow_step_exec_schedule_idx
  ON appointment_workflow_step_executions (workspace_id, scheduled_for, state);
CREATE INDEX IF NOT EXISTS appointment_workflow_step_exec_execution_idx
  ON appointment_workflow_step_executions (execution_id);
