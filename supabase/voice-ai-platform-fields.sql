-- Telnyx AI Voice platform entities (additive, safe on existing DBs)
-- Prefer: npm run db:push with DATABASE_URL. This SQL is a manual fallback.

-- New columns on voice_agents
ALTER TABLE IF EXISTS "voice_agents"
  ADD COLUMN IF NOT EXISTS "emergencyDisabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "multiPartyEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "outboundAiEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "widgetEnabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "memoryConfigId" text,
  ADD COLUMN IF NOT EXISTS "insightGroupId" text,
  ADD COLUMN IF NOT EXISTS "observabilityConfigId" text;

-- New columns on voice_agent_versions
ALTER TABLE IF EXISTS "voice_agent_versions"
  ADD COLUMN IF NOT EXISTS "telnyxVersionId" text,
  ADD COLUMN IF NOT EXISTS "isMain" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deploymentStatus" text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS "testStatus" text;

CREATE TABLE IF NOT EXISTS "voice_remote_assistant_versions" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text NOT NULL REFERENCES "voice_agents"("id") ON DELETE CASCADE,
  "telnyxAssistantId" text NOT NULL,
  "telnyxVersionId" text NOT NULL,
  "name" text,
  "label" text,
  "isMain" boolean NOT NULL DEFAULT false,
  "configJson" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "syncedAt" timestamptz,
  UNIQUE ("agentId", "telnyxVersionId")
);
CREATE INDEX IF NOT EXISTS "voice_remote_assistant_versions_workspaceId_idx"
  ON "voice_remote_assistant_versions" ("workspaceId");

CREATE TABLE IF NOT EXISTS "voice_canary_deploys" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text NOT NULL REFERENCES "voice_agents"("id") ON DELETE CASCADE,
  "telnyxAssistantId" text NOT NULL,
  "rulesJson" jsonb NOT NULL,
  "percentage" integer,
  "status" text NOT NULL DEFAULT 'draft',
  "startAt" timestamptz,
  "stopAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "syncedAt" timestamptz
);
CREATE INDEX IF NOT EXISTS "voice_canary_deploys_workspaceId_status_idx"
  ON "voice_canary_deploys" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_canary_deploys_agentId_idx"
  ON "voice_canary_deploys" ("agentId");

CREATE TABLE IF NOT EXISTS "voice_assistant_tests" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "telnyxTestId" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "suiteName" text,
  "configJson" jsonb,
  "criteriaJson" jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_assistant_tests_workspaceId_status_idx"
  ON "voice_assistant_tests" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_assistant_tests_agentId_idx"
  ON "voice_assistant_tests" ("agentId");
CREATE INDEX IF NOT EXISTS "voice_assistant_tests_telnyxTestId_idx"
  ON "voice_assistant_tests" ("telnyxTestId");

CREATE TABLE IF NOT EXISTS "voice_test_suites" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("workspaceId", "name")
);

CREATE TABLE IF NOT EXISTS "voice_assistant_test_runs" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "testId" text REFERENCES "voice_assistant_tests"("id") ON DELETE SET NULL,
  "suiteName" text,
  "telnyxRunId" text,
  "status" text NOT NULL DEFAULT 'pending',
  "resultsJson" jsonb,
  "startedAt" timestamptz,
  "completedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_assistant_test_runs_workspaceId_createdAt_idx"
  ON "voice_assistant_test_runs" ("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "voice_assistant_test_runs_testId_idx"
  ON "voice_assistant_test_runs" ("testId");

CREATE TABLE IF NOT EXISTS "voice_assistant_tags" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text NOT NULL REFERENCES "voice_agents"("id") ON DELETE CASCADE,
  "tag" text NOT NULL,
  "telnyxSynced" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("agentId", "tag")
);
CREATE INDEX IF NOT EXISTS "voice_assistant_tags_workspaceId_idx"
  ON "voice_assistant_tags" ("workspaceId");

CREATE TABLE IF NOT EXISTS "voice_ai_conversations" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "callId" text,
  "contactId" text,
  "phoneNumberId" text,
  "telnyxConversationId" text,
  "channel" text,
  "metadata" jsonb,
  "status" text NOT NULL DEFAULT 'open',
  "startedAt" timestamptz,
  "endedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_workspaceId_telnyxConversationId_idx"
  ON "voice_ai_conversations" ("workspaceId", "telnyxConversationId");
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_workspaceId_createdAt_idx"
  ON "voice_ai_conversations" ("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_agentId_idx"
  ON "voice_ai_conversations" ("agentId");
CREATE INDEX IF NOT EXISTS "voice_ai_conversations_callId_idx"
  ON "voice_ai_conversations" ("callId");

CREATE TABLE IF NOT EXISTS "voice_ai_conversation_messages" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "conversationId" text NOT NULL REFERENCES "voice_ai_conversations"("id") ON DELETE CASCADE,
  "telnyxMessageId" text,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_ai_conversation_messages_conversationId_createdAt_idx"
  ON "voice_ai_conversation_messages" ("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "voice_ai_conversation_messages_workspaceId_idx"
  ON "voice_ai_conversation_messages" ("workspaceId");

CREATE TABLE IF NOT EXISTS "voice_memory_configs" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "mode" text NOT NULL DEFAULT 'none',
  "retentionDays" integer,
  "excludeFields" jsonb,
  "configJson" jsonb,
  "telnyxPrivacyJson" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_memory_configs_workspaceId_idx"
  ON "voice_memory_configs" ("workspaceId");
CREATE INDEX IF NOT EXISTS "voice_memory_configs_agentId_idx"
  ON "voice_memory_configs" ("agentId");

CREATE TABLE IF NOT EXISTS "voice_insight_definitions" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "telnyxInsightId" text,
  "name" text NOT NULL,
  "description" text,
  "instructions" text,
  "jsonSchema" jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_insight_definitions_workspaceId_status_idx"
  ON "voice_insight_definitions" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_insight_definitions_telnyxInsightId_idx"
  ON "voice_insight_definitions" ("telnyxInsightId");

CREATE TABLE IF NOT EXISTS "voice_insight_groups" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "telnyxGroupId" text,
  "name" text NOT NULL,
  "description" text,
  "webhookUrl" text,
  "insightIds" jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_insight_groups_workspaceId_status_idx"
  ON "voice_insight_groups" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_insight_groups_telnyxGroupId_idx"
  ON "voice_insight_groups" ("telnyxGroupId");

CREATE TABLE IF NOT EXISTS "voice_scheduled_events" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text NOT NULL REFERENCES "voice_agents"("id") ON DELETE CASCADE,
  "telnyxAssistantId" text,
  "telnyxEventId" text,
  "channel" text NOT NULL,
  "endUserTarget" text NOT NULL,
  "agentTarget" text NOT NULL,
  "scheduledAt" timestamptz NOT NULL,
  "text" text,
  "dynamicVariables" jsonb,
  "metadata" jsonb,
  "maxRetries" integer,
  "retryIntervalSecs" integer,
  "status" text NOT NULL DEFAULT 'scheduled',
  "consentRecorded" boolean NOT NULL DEFAULT false,
  "enabledByPolicy" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "completedAt" timestamptz
);
CREATE INDEX IF NOT EXISTS "voice_scheduled_events_workspaceId_scheduledAt_idx"
  ON "voice_scheduled_events" ("workspaceId", "scheduledAt");
CREATE INDEX IF NOT EXISTS "voice_scheduled_events_agentId_status_idx"
  ON "voice_scheduled_events" ("agentId", "status");
CREATE INDEX IF NOT EXISTS "voice_scheduled_events_telnyxEventId_idx"
  ON "voice_scheduled_events" ("telnyxEventId");

CREATE TABLE IF NOT EXISTS "voice_mcp_servers" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "telnyxMcpId" text,
  "name" text NOT NULL,
  "url" text NOT NULL,
  "type" text,
  "status" text NOT NULL DEFAULT 'draft',
  "configJson" jsonb,
  "credentialsRef" text,
  "approved" boolean NOT NULL DEFAULT false,
  "lastTestAt" timestamptz,
  "lastTestOk" boolean,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_mcp_servers_workspaceId_status_idx"
  ON "voice_mcp_servers" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_mcp_servers_telnyxMcpId_idx"
  ON "voice_mcp_servers" ("telnyxMcpId");

CREATE TABLE IF NOT EXISTS "voice_observability_configs" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "provider" text NOT NULL DEFAULT 'telnyx',
  "configJson" jsonb,
  "langfuseEnabled" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_observability_configs_workspaceId_idx"
  ON "voice_observability_configs" ("workspaceId");
CREATE INDEX IF NOT EXISTS "voice_observability_configs_agentId_idx"
  ON "voice_observability_configs" ("agentId");

CREATE TABLE IF NOT EXISTS "voice_concurrency_allocations" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "maxInboundAi" integer NOT NULL DEFAULT 5,
  "maxOutboundAi" integer NOT NULL DEFAULT 0,
  "maxTransferLegs" integer NOT NULL DEFAULT 10,
  "softAlertPct" integer NOT NULL DEFAULT 80,
  "hardSpendLimitCents" integer,
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "voice_failure_diagnostics" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "callId" text,
  "category" text NOT NULL,
  "code" text,
  "message" text NOT NULL,
  "detailsJson" jsonb,
  "resolved" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "resolvedAt" timestamptz
);
CREATE INDEX IF NOT EXISTS "voice_failure_diagnostics_workspaceId_createdAt_idx"
  ON "voice_failure_diagnostics" ("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "voice_failure_diagnostics_agentId_idx"
  ON "voice_failure_diagnostics" ("agentId");
CREATE INDEX IF NOT EXISTS "voice_failure_diagnostics_callId_idx"
  ON "voice_failure_diagnostics" ("callId");

CREATE TABLE IF NOT EXISTS "voice_transfer_destinations" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text REFERENCES "voice_agents"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "destination" text NOT NULL,
  "businessHoursJson" jsonb,
  "fallbackDestination" text,
  "voicemailOnFail" boolean NOT NULL DEFAULT true,
  "returnToAiOnFail" boolean NOT NULL DEFAULT true,
  "maxAttempts" integer NOT NULL DEFAULT 2,
  "enabled" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("workspaceId", "name", "agentId")
);
CREATE INDEX IF NOT EXISTS "voice_transfer_destinations_workspaceId_agentId_idx"
  ON "voice_transfer_destinations" ("workspaceId", "agentId");

CREATE TABLE IF NOT EXISTS "voice_widget_configs" (
  "id" text PRIMARY KEY,
  "workspaceId" text NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "agentId" text NOT NULL REFERENCES "voice_agents"("id") ON DELETE CASCADE,
  "domainAllowlist" jsonb,
  "rateLimitPerMin" integer NOT NULL DEFAULT 30,
  "captchaEnabled" boolean NOT NULL DEFAULT true,
  "testMode" boolean NOT NULL DEFAULT true,
  "configJson" jsonb,
  "status" text NOT NULL DEFAULT 'draft',
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "voice_widget_configs_workspaceId_status_idx"
  ON "voice_widget_configs" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_widget_configs_agentId_idx"
  ON "voice_widget_configs" ("agentId");
