-- Durable idempotency records for appointment AI consequential mutations.
-- Survives process restarts and multi-instance deployments.

CREATE TABLE IF NOT EXISTS appointment_ai_mutation_records (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "idempotencyKey" TEXT NOT NULL,
  "requestId" TEXT,
  "contactId" TEXT,
  channel TEXT NOT NULL,
  "actionKind" TEXT NOT NULL,
  "actionPayloadJson" JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  "outcomeJson" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_ai_mutation_records_ws_idem
  ON appointment_ai_mutation_records ("workspaceId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS appointment_ai_mutation_records_ws_contact_created
  ON appointment_ai_mutation_records ("workspaceId", "contactId", "createdAt");

CREATE INDEX IF NOT EXISTS appointment_ai_mutation_records_ws_status_created
  ON appointment_ai_mutation_records ("workspaceId", status, "createdAt");
