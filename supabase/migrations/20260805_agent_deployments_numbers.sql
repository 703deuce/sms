-- Agent deployments + customer external numbers (routing control center).
-- Additive only. Safe to re-run.

ALTER TABLE "PhoneNumber"
  ADD COLUMN IF NOT EXISTS "ownershipType" TEXT NOT NULL DEFAULT 'transovo';

CREATE TABLE IF NOT EXISTS external_numbers (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  e164 TEXT NOT NULL,
  "displayName" TEXT,
  carrier TEXT,
  "forwardingDestinationId" TEXT REFERENCES "PhoneNumber"(id) ON DELETE SET NULL,
  "forwardingStatus" TEXT NOT NULL DEFAULT 'none',
  "forwardingMode" TEXT NOT NULL DEFAULT 'always',
  notes TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS external_numbers_ws_e164
  ON external_numbers ("workspaceId", e164);
CREATE INDEX IF NOT EXISTS external_numbers_ws_fwd
  ON external_numbers ("workspaceId", "forwardingStatus");

CREATE TABLE IF NOT EXISTS agent_deployments (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "agentId" TEXT REFERENCES voice_agents(id) ON DELETE CASCADE,
  "solutionSetupId" TEXT,
  "phoneNumberId" TEXT REFERENCES "PhoneNumber"(id) ON DELETE SET NULL,
  "externalNumberId" TEXT REFERENCES external_numbers(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  "routingMode" TEXT NOT NULL DEFAULT 'test',
  "scheduleKey" TEXT NOT NULL DEFAULT 'always',
  status TEXT NOT NULL DEFAULT 'draft',
  "errorMessage" TEXT,
  "deployedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS agent_deployments_ws_status
  ON agent_deployments ("workspaceId", status);
CREATE INDEX IF NOT EXISTS agent_deployments_ws_phone
  ON agent_deployments ("workspaceId", "phoneNumberId");
CREATE INDEX IF NOT EXISTS agent_deployments_ws_agent
  ON agent_deployments ("workspaceId", "agentId");
CREATE INDEX IF NOT EXISTS agent_deployments_ws_setup
  ON agent_deployments ("workspaceId", "solutionSetupId");
