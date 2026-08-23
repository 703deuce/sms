-- pragma: allowlist secret
-- Smart Routing AI assistant proposals and recommendations

CREATE TABLE IF NOT EXISTS smart_routing_ai_proposals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  flow_id TEXT,
  status TEXT NOT NULL DEFAULT 'ai_proposed',
  intent TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  summary TEXT,
  assumptions_json JSONB NOT NULL DEFAULT '[]',
  warnings_json JSONB NOT NULL DEFAULT '[]',
  proposed_changes_json JSONB NOT NULL DEFAULT '[]',
  clarification_question TEXT,
  current_snapshot_json JSONB,
  proposed_draft_json JSONB,
  validation_json JSONB,
  base_flow_updated_at TIMESTAMPTZ,
  flow_revision_before TEXT,
  invocation_json JSONB,
  temporary_override_json JSONB,
  undo_snapshot_json JSONB,
  created_by TEXT,
  approved_by TEXT,
  rejected_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS smart_routing_ai_proposals_workspace_created
  ON smart_routing_ai_proposals (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS smart_routing_ai_proposals_workspace_flow_status
  ON smart_routing_ai_proposals (workspace_id, flow_id, status);

CREATE TABLE IF NOT EXISTS smart_routing_ai_recommendations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  flow_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recommendation_json JSONB,
  metrics_json JSONB,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS smart_routing_ai_recommendations_workspace_status
  ON smart_routing_ai_recommendations (workspace_id, status);
CREATE INDEX IF NOT EXISTS smart_routing_ai_recommendations_workspace_created
  ON smart_routing_ai_recommendations (workspace_id, created_at);
