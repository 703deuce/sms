-- Drip Campaigns V1 — event-triggered timed SMS sequences

CREATE TABLE IF NOT EXISTS drip_campaigns (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "triggerConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "phoneNumberId" TEXT,
  status TEXT NOT NULL DEFAULT 'paused',
  "stepsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "triggeredCount" INTEGER NOT NULL DEFAULT 0,
  "messagesSent" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drip_campaign_enrollments (
  id TEXT PRIMARY KEY,
  "dripCampaignId" TEXT NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
  "nextRunAt" TIMESTAMPTZ,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt" TIMESTAMPTZ,
  "lastSentAt" TIMESTAMPTZ,
  replied BOOLEAN NOT NULL DEFAULT false,
  opened BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("dripCampaignId", "contactId")
);

CREATE INDEX IF NOT EXISTS drip_campaigns_workspace_status_idx
  ON drip_campaigns ("workspaceId", status);

CREATE INDEX IF NOT EXISTS drip_campaigns_workspace_trigger_idx
  ON drip_campaigns ("workspaceId", "triggerType");

CREATE INDEX IF NOT EXISTS drip_campaign_enrollments_workspace_status_idx
  ON drip_campaign_enrollments ("workspaceId", status);

CREATE INDEX IF NOT EXISTS drip_campaign_enrollments_campaign_status_idx
  ON drip_campaign_enrollments ("dripCampaignId", status);

CREATE INDEX IF NOT EXISTS drip_campaign_enrollments_next_run_idx
  ON drip_campaign_enrollments ("nextRunAt");
