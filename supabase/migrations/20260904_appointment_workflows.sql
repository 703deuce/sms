-- Appointment workflows (isolated from drip_campaigns / SMS playbooks)

CREATE TABLE IF NOT EXISTS appointment_workflows (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'custom',
  "templateId" TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active',
  trigger TEXT NOT NULL,
  "appointmentTypeScope" JSONB NOT NULL DEFAULT '{}',
  channels JSONB NOT NULL DEFAULT '[]',
  conditions JSONB,
  "stepsJson" JSONB NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_workflows_workspace_status_idx
  ON appointment_workflows ("workspaceId", status);
CREATE INDEX IF NOT EXISTS appointment_workflows_workspace_trigger_idx
  ON appointment_workflows ("workspaceId", trigger);

CREATE TABLE IF NOT EXISTS appointment_workflow_executions (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "workflowId" TEXT NOT NULL REFERENCES appointment_workflows(id) ON DELETE CASCADE,
  "workflowVersion" INTEGER NOT NULL DEFAULT 1,
  "appointmentId" TEXT NOT NULL,
  "contactId" TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ,
  "invalidatedAt" TIMESTAMPTZ,
  "invalidateReason" TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS appointment_workflow_executions_ws_appt_idx
  ON appointment_workflow_executions ("workspaceId", "appointmentId");
CREATE INDEX IF NOT EXISTS appointment_workflow_executions_wf_status_idx
  ON appointment_workflow_executions ("workflowId", status);

CREATE TABLE IF NOT EXISTS appointment_workflow_step_executions (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL REFERENCES appointment_workflow_executions(id) ON DELETE CASCADE,
  "workflowId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "scheduledFor" TIMESTAMPTZ NOT NULL,
  "executedAt" TIMESTAMPTZ,
  state TEXT NOT NULL DEFAULT 'scheduled',
  channel TEXT,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "providerMessageId" TEXT,
  "failureReason" TEXT,
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_workflow_step_exec_schedule_idx
  ON appointment_workflow_step_executions ("workspaceId", "scheduledFor", state);
CREATE INDEX IF NOT EXISTS appointment_workflow_step_exec_execution_idx
  ON appointment_workflow_step_executions ("executionId");
