-- Smart Routing AI assistant — supplemental indexes
-- Tables/columns are created by Prisma (`npm run db:push`). This file only adds
-- indexes if missing (safe to re-run).

CREATE INDEX IF NOT EXISTS smart_routing_ai_proposals_workspace_created
  ON smart_routing_ai_proposals ("workspaceId", "createdAt");

CREATE INDEX IF NOT EXISTS smart_routing_ai_proposals_workspace_flow_status
  ON smart_routing_ai_proposals ("workspaceId", "flowId", status);

CREATE INDEX IF NOT EXISTS smart_routing_ai_recommendations_workspace_status
  ON smart_routing_ai_recommendations ("workspaceId", status);

CREATE INDEX IF NOT EXISTS smart_routing_ai_recommendations_workspace_created
  ON smart_routing_ai_recommendations ("workspaceId", "createdAt");
