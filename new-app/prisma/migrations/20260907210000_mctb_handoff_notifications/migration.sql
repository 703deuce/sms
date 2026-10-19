-- MCTB Lead Handoff & Notifications domain

CREATE TABLE "mctb_handoff_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "responseMode" TEXT NOT NULL DEFAULT 'notify_only',
    "emergencyDetectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emergencyCriteria" TEXT,
    "emergencyAction" TEXT NOT NULL DEFAULT 'notify_only',
    "emergencyUncertainBehavior" TEXT NOT NULL DEFAULT 'handoff_human',
    "bookingBehavior" TEXT NOT NULL DEFAULT 'off',
    "fieldSchemaJson" JSONB NOT NULL DEFAULT '{}',
    "routingMatrixJson" JSONB NOT NULL DEFAULT '{}',
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "quietHoursEmergencyBypass" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursNonUrgentSmsDelay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mctb_handoff_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mctb_handoff_configs_workspaceId_key" ON "mctb_handoff_configs"("workspaceId");

CREATE TABLE "mctb_notification_recipients" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "mobileE164" TEXT,
    "roleDescription" TEXT,
    "eventChannelsJson" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mctb_notification_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mctb_notification_recipients_workspaceId_enabled_idx" ON "mctb_notification_recipients"("workspaceId", "enabled");

CREATE TABLE "mctb_conversation_automation_states" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "missedCallEventId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'waiting_for_caller',
    "responseMode" TEXT,
    "capturedFieldsJson" JSONB NOT NULL DEFAULT '{}',
    "activeFieldId" TEXT,
    "humanTakenOverAt" TIMESTAMP(3),
    "humanTakenOverByUserId" TEXT,
    "followUpStatus" TEXT,
    "followUpActorUserId" TEXT,
    "followUpAt" TIMESTAMP(3),
    "appointmentId" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mctb_conversation_automation_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mctb_conversation_automation_states_conversationId_key" ON "mctb_conversation_automation_states"("conversationId");
CREATE INDEX "mctb_conversation_automation_states_workspaceId_missedCallEventId_idx" ON "mctb_conversation_automation_states"("workspaceId", "missedCallEventId");
CREATE INDEX "mctb_conversation_automation_states_workspaceId_state_idx" ON "mctb_conversation_automation_states"("workspaceId", "state");

CREATE TABLE "mctb_lead_snapshots" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "missedCallEventId" TEXT,
    "conversationId" TEXT,
    "triggerEvent" TEXT NOT NULL,
    "customerFactsJson" JSONB NOT NULL DEFAULT '{}',
    "aiDerivedJson" JSONB NOT NULL DEFAULT '{}',
    "summaryText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mctb_lead_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mctb_lead_snapshots_workspaceId_conversationId_idx" ON "mctb_lead_snapshots"("workspaceId", "conversationId");
CREATE INDEX "mctb_lead_snapshots_workspaceId_missedCallEventId_idx" ON "mctb_lead_snapshots"("workspaceId", "missedCallEventId");

CREATE TABLE "mctb_urgency_assessments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "missedCallEventId" TEXT,
    "customerText" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reason" TEXT,
    "ruleVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mctb_urgency_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mctb_urgency_assessments_workspaceId_conversationId_idx" ON "mctb_urgency_assessments"("workspaceId", "conversationId");

CREATE TABLE "mctb_handoff_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "missedCallEventId" TEXT,
    "conversationId" TEXT,
    "eventType" TEXT NOT NULL,
    "leadSnapshotId" TEXT,
    "urgencyAssessmentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mctb_handoff_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mctb_handoff_events_idempotencyKey_key" ON "mctb_handoff_events"("idempotencyKey");
CREATE INDEX "mctb_handoff_events_workspaceId_eventType_createdAt_idx" ON "mctb_handoff_events"("workspaceId", "eventType", "createdAt");
CREATE INDEX "mctb_handoff_events_workspaceId_conversationId_idx" ON "mctb_handoff_events"("workspaceId", "conversationId");

CREATE TABLE "mctb_notification_deliveries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "handoffEventId" TEXT NOT NULL,
    "recipientId" TEXT,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "mctb_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mctb_notification_deliveries_idempotencyKey_key" ON "mctb_notification_deliveries"("idempotencyKey");
CREATE INDEX "mctb_notification_deliveries_workspaceId_handoffEventId_idx" ON "mctb_notification_deliveries"("workspaceId", "handoffEventId");
CREATE INDEX "mctb_notification_deliveries_workspaceId_status_idx" ON "mctb_notification_deliveries"("workspaceId", "status");

ALTER TABLE "mctb_handoff_configs" ADD CONSTRAINT "mctb_handoff_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_notification_recipients" ADD CONSTRAINT "mctb_notification_recipients_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_conversation_automation_states" ADD CONSTRAINT "mctb_conversation_automation_states_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_lead_snapshots" ADD CONSTRAINT "mctb_lead_snapshots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_urgency_assessments" ADD CONSTRAINT "mctb_urgency_assessments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_handoff_events" ADD CONSTRAINT "mctb_handoff_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_handoff_events" ADD CONSTRAINT "mctb_handoff_events_leadSnapshotId_fkey" FOREIGN KEY ("leadSnapshotId") REFERENCES "mctb_lead_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mctb_handoff_events" ADD CONSTRAINT "mctb_handoff_events_urgencyAssessmentId_fkey" FOREIGN KEY ("urgencyAssessmentId") REFERENCES "mctb_urgency_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mctb_notification_deliveries" ADD CONSTRAINT "mctb_notification_deliveries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_notification_deliveries" ADD CONSTRAINT "mctb_notification_deliveries_handoffEventId_fkey" FOREIGN KEY ("handoffEventId") REFERENCES "mctb_handoff_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mctb_notification_deliveries" ADD CONSTRAINT "mctb_notification_deliveries_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "mctb_notification_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
