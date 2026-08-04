-- Connected architecture: SolutionSetup, linking fields, platform events.
-- Additive only. Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS patterns).

CREATE TABLE IF NOT EXISTS solution_setups (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "solutionType" TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  "configJson" JSONB,
  "linkedAgentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedAutomationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedCampaignIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedPhoneNumberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedCalendarIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedRoutingRuleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkedTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "externalKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS solution_setups_ws_type_key
  ON solution_setups ("workspaceId", "solutionType", "externalKey");
CREATE INDEX IF NOT EXISTS solution_setups_ws_type
  ON solution_setups ("workspaceId", "solutionType");
CREATE INDEX IF NOT EXISTS solution_setups_ws_status
  ON solution_setups ("workspaceId", status);

CREATE TABLE IF NOT EXISTS platform_events (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "contactId" TEXT,
  "solutionSetupId" TEXT,
  "automationId" TEXT,
  "agentId" TEXT,
  "campaignId" TEXT,
  "callId" TEXT,
  "messageId" TEXT,
  payload JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_events_ws_idem
  ON platform_events ("workspaceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS platform_events_ws_type_created
  ON platform_events ("workspaceId", type, "createdAt");
CREATE INDEX IF NOT EXISTS platform_events_ws_contact
  ON platform_events ("workspaceId", "contactId");

ALTER TABLE "AutomationFlow"
  ADD COLUMN IF NOT EXISTS "sourceSolutionSetupId" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedAgentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "linkedCampaignIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "linkedPhoneNumberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "linkedCalendarIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "linkedTemplateIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "advancedCustomized" BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AutomationFlow_sourceSolutionSetupId_fkey'
  ) THEN
    ALTER TABLE "AutomationFlow"
      ADD CONSTRAINT "AutomationFlow_sourceSolutionSetupId_fkey"
      FOREIGN KEY ("sourceSolutionSetupId") REFERENCES solution_setups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS AutomationFlow_ws_setup
  ON "AutomationFlow" ("workspaceId", "sourceSolutionSetupId");

ALTER TABLE voice_agents
  ADD COLUMN IF NOT EXISTS "sourceSolutionSetupId" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedAutomationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "linkedPhoneNumberIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "linkedCalendarIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "postCallAutomationId" TEXT,
  ADD COLUMN IF NOT EXISTS "fallbackAutomationId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'voice_agents_sourceSolutionSetupId_fkey'
  ) THEN
    ALTER TABLE voice_agents
      ADD CONSTRAINT "voice_agents_sourceSolutionSetupId_fkey"
      FOREIGN KEY ("sourceSolutionSetupId") REFERENCES solution_setups(id) ON DELETE SET NULL;
  END IF;
END $$;
