-- Temporary callback codes for employee PIN bypass

CREATE TABLE IF NOT EXISTS smart_routing_callback_codes (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "authorizedCallerId" TEXT NOT NULL REFERENCES smart_routing_authorized_callers(id) ON DELETE CASCADE,
  "codeHash" TEXT NOT NULL,
  label TEXT,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_callback_codes_workspace
  ON smart_routing_callback_codes("workspaceId", "authorizedCallerId");
CREATE INDEX IF NOT EXISTS idx_sr_callback_codes_expires
  ON smart_routing_callback_codes("expiresAt");
