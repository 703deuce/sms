-- Smart Routing standalone product V1 — supplemental indexes
-- Tables/columns are created by Prisma (`npm run db:push`). This file only adds
-- indexes if missing (safe to re-run).

CREATE INDEX IF NOT EXISTS smart_routing_authorized_callers_workspace_idx
  ON smart_routing_authorized_callers ("workspaceId", active);

CREATE INDEX IF NOT EXISTS smart_routing_access_sessions_call_control_idx
  ON smart_routing_access_sessions ("callControlId");

CREATE INDEX IF NOT EXISTS smart_routing_access_sessions_workspace_created_idx
  ON smart_routing_access_sessions ("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS smart_routing_outbound_calls_workspace_idx
  ON smart_routing_outbound_calls ("workspaceId", "createdAt");
