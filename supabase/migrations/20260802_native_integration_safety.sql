-- Native integrations: action audit, AI approvals, alerts, context cache,
-- normalized tasks/orders, workspace AI policy.
-- Safe for existing Zoho/Pipedrive CRM tables (additive only).

CREATE TABLE IF NOT EXISTS integration_action_logs (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  "connectionId" TEXT,
  source TEXT NOT NULL,
  "actorUserId" TEXT,
  "automationFlowId" TEXT,
  "actionId" TEXT NOT NULL,
  "riskLevel" INTEGER NOT NULL DEFAULT 3,
  "inputSummaryJson" JSONB,
  "objectType" TEXT,
  "objectIdsJson" JSONB,
  "contactId" TEXT,
  "approvalId" TEXT,
  "policyJson" JSONB,
  "idempotencyKey" TEXT,
  "providerRequestId" TEXT,
  result TEXT NOT NULL DEFAULT 'queued',
  "failureReason" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  reversible BOOLEAN NOT NULL DEFAULT false,
  "undoJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_action_logs_ws_idem
  ON integration_action_logs ("workspaceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS integration_action_logs_ws_provider_created
  ON integration_action_logs ("workspaceId", provider, "createdAt");
CREATE INDEX IF NOT EXISTS integration_action_logs_ws_source_result
  ON integration_action_logs ("workspaceId", source, result);
CREATE INDEX IF NOT EXISTS integration_action_logs_ws_contact
  ON integration_action_logs ("workspaceId", "contactId");

CREATE TABLE IF NOT EXISTS ai_action_approvals (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "requestedByUserId" TEXT NOT NULL,
  provider TEXT NOT NULL,
  "connectionId" TEXT,
  "actionId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "riskLevel" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "approverUserId" TEXT,
  "previewJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ai_action_approvals_ws_status_exp
  ON ai_action_approvals ("workspaceId", status, "expiresAt");
CREATE INDEX IF NOT EXISTS ai_action_approvals_ws_hash
  ON ai_action_approvals ("workspaceId", "payloadHash");

CREATE TABLE IF NOT EXISTS integration_alerts (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  provider TEXT,
  "connectionId" TEXT,
  severity TEXT NOT NULL DEFAULT 'warn',
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  "detailJson" JSONB,
  audience TEXT NOT NULL DEFAULT 'customer',
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS integration_alerts_ws_ack_created
  ON integration_alerts ("workspaceId", "acknowledgedAt", "createdAt");
CREATE INDEX IF NOT EXISTS integration_alerts_ws_kind
  ON integration_alerts ("workspaceId", kind);

CREATE TABLE IF NOT EXISTS integration_context_caches (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "contactId" TEXT NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "staleAt" TIMESTAMP(3),
  "lastError" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_context_caches_ws_contact
  ON integration_context_caches ("workspaceId", "contactId");
CREATE INDEX IF NOT EXISTS integration_context_caches_ws_refreshed
  ON integration_context_caches ("workspaceId", "refreshedAt");

CREATE TABLE IF NOT EXISTS integration_tasks (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "contactId" TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  "dueAt" TIMESTAMP(3),
  "ownerExternalId" TEXT,
  "ownerName" TEXT,
  priority TEXT,
  "relatedDealId" TEXT,
  "relatedCompanyId" TEXT,
  "relatedTicketId" TEXT,
  "syncStatus" TEXT NOT NULL DEFAULT 'synced',
  "externalUrl" TEXT,
  "metadataJson" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_tasks_ws_provider_ext
  ON integration_tasks ("workspaceId", provider, "externalId");
CREATE INDEX IF NOT EXISTS integration_tasks_ws_status_due
  ON integration_tasks ("workspaceId", status, "dueAt");
CREATE INDEX IF NOT EXISTS integration_tasks_ws_contact
  ON integration_tasks ("workspaceId", "contactId");

CREATE TABLE IF NOT EXISTS integration_orders (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "contactId" TEXT,
  "orderNumber" TEXT,
  status TEXT,
  total TEXT,
  currency TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "customerName" TEXT,
  "paidAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdExternalAt" TIMESTAMP(3),
  "syncStatus" TEXT NOT NULL DEFAULT 'synced',
  "externalUrl" TEXT,
  "lineItemsJson" JSONB,
  "shippingJson" JSONB,
  "metadataJson" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS integration_orders_ws_provider_ext
  ON integration_orders ("workspaceId", provider, "externalId");
CREATE INDEX IF NOT EXISTS integration_orders_ws_status_created
  ON integration_orders ("workspaceId", status, "createdAt");
CREATE INDEX IF NOT EXISTS integration_orders_ws_contact
  ON integration_orders ("workspaceId", "contactId");
CREATE INDEX IF NOT EXISTS integration_orders_ws_number
  ON integration_orders ("workspaceId", "orderNumber");

CREATE TABLE IF NOT EXISTS workspace_ai_integration_policies (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "policyJson" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
