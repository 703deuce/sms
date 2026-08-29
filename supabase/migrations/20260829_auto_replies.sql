-- Auto Replies V1 — one-message event triggers (list join, new contact, form, after hours, tag)

CREATE TABLE IF NOT EXISTS auto_replies (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "triggerConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  message TEXT NOT NULL,
  "mediaUrls" TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'paused',
  "rulesJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "sendCount" INTEGER NOT NULL DEFAULT 0,
  "lastTriggeredAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auto_replies_workspace_status_idx
  ON auto_replies ("workspaceId", status);

CREATE INDEX IF NOT EXISTS auto_replies_workspace_trigger_idx
  ON auto_replies ("workspaceId", "triggerType");
