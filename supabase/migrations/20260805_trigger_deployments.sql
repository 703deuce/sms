-- Trigger deployments: compiled from workflow trigger nodes on Activate.
-- Source of truth for editing = canvas trigger. This table is the audit / My Numbers view.
-- Additive; safe to re-run.

CREATE TABLE IF NOT EXISTS trigger_deployments (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "flowId" TEXT NOT NULL REFERENCES "AutomationFlow"(id) ON DELETE CASCADE,
  "triggerNodeId" TEXT NOT NULL,
  "triggerBlockType" TEXT NOT NULL,
  channel TEXT NOT NULL,
  "phoneNumberId" TEXT REFERENCES "PhoneNumber"(id) ON DELETE SET NULL,
  "eventType" TEXT NOT NULL DEFAULT 'every_call',
  "scheduleKey" TEXT NOT NULL DEFAULT 'always',
  status TEXT NOT NULL DEFAULT 'draft',
  "pauseFallback" TEXT NOT NULL DEFAULT 'human',
  "pauseFallbackNumber" TEXT,
  "pauseFallbackFlowId" TEXT,
  "providerConfig" JSONB,
  "errorMessage" TEXT,
  "deployedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS trigger_deployments_flow_node
  ON trigger_deployments ("flowId", "triggerNodeId");
CREATE INDEX IF NOT EXISTS trigger_deployments_ws_phone_status
  ON trigger_deployments ("workspaceId", "phoneNumberId", status);
CREATE INDEX IF NOT EXISTS trigger_deployments_ws_status_event
  ON trigger_deployments ("workspaceId", status, "eventType");
