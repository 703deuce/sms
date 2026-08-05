-- Agent ↔ AutomationFlow ownership (wizard compiles into agent + workflow).
-- Additive only. Safe to re-run.

ALTER TABLE solution_setups
  ADD COLUMN IF NOT EXISTS "primaryFlowId" TEXT;

CREATE INDEX IF NOT EXISTS solution_setups_ws_primary_flow
  ON solution_setups ("workspaceId", "primaryFlowId");

ALTER TABLE voice_agents
  ADD COLUMN IF NOT EXISTS "primaryFlowId" TEXT;

ALTER TABLE voice_agents
  ADD COLUMN IF NOT EXISTS "executionType" TEXT NOT NULL DEFAULT 'realtime_voice';

CREATE INDEX IF NOT EXISTS voice_agents_ws_primary_flow
  ON voice_agents ("workspaceId", "primaryFlowId");

ALTER TABLE "AutomationFlow"
  ADD COLUMN IF NOT EXISTS "ownerAgentId" TEXT REFERENCES voice_agents(id) ON DELETE SET NULL;

ALTER TABLE "AutomationFlow"
  ADD COLUMN IF NOT EXISTS "ownershipKind" TEXT NOT NULL DEFAULT 'standalone';

ALTER TABLE "AutomationFlow"
  ADD COLUMN IF NOT EXISTS "ownerLabel" TEXT;

CREATE INDEX IF NOT EXISTS automation_flow_ws_owner_agent
  ON "AutomationFlow" ("workspaceId", "ownerAgentId");
CREATE INDEX IF NOT EXISTS automation_flow_ws_ownership_kind
  ON "AutomationFlow" ("workspaceId", "ownershipKind");

-- Backfill agent workflows from existing solution-generated flows.
UPDATE "AutomationFlow"
SET
  "ownershipKind" = 'agent_workflow',
  "ownerLabel" = COALESCE(
    NULLIF(TRIM(REPLACE("description", 'Generated from ', '')), ''),
    name
  )
WHERE COALESCE("ownershipKind", 'standalone') = 'standalone'
  AND (
    "sourceSolutionSetupId" IS NOT NULL
    OR "description" LIKE 'Generated from %'
  );

UPDATE solution_setups
SET "primaryFlowId" = "linkedAutomationIds"[1]
WHERE "primaryFlowId" IS NULL
  AND cardinality("linkedAutomationIds") > 0;

UPDATE voice_agents
SET "primaryFlowId" = COALESCE(
  "postCallAutomationId",
  "fallbackAutomationId",
  CASE WHEN cardinality("linkedAutomationIds") > 0 THEN "linkedAutomationIds"[1] ELSE NULL END
)
WHERE "primaryFlowId" IS NULL
  AND (
    "postCallAutomationId" IS NOT NULL
    OR "fallbackAutomationId" IS NOT NULL
    OR cardinality("linkedAutomationIds") > 0
  );
