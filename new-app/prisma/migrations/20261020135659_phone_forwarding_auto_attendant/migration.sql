-- CreateTable
CREATE TABLE "forwarding_destinations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "screeningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "press1Required" BOOLEAN NOT NULL DEFAULT false,
    "privateAnnouncement" TEXT,
    "ringTimeoutSec" INTEGER NOT NULL DEFAULT 25,
    "callerIdPolicy" TEXT NOT NULL DEFAULT 'original',
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forwarding_destinations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forwarding_groups" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strategy" TEXT NOT NULL DEFAULT 'sequential',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fallbackJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forwarding_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forwarding_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "forwarding_group_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auto_attendant_menus" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "greetingMode" TEXT NOT NULL DEFAULT 'tts',
    "greetingText" TEXT,
    "greetingAudioUrl" TEXT,
    "voice" TEXT DEFAULT 'Telnyx.KokoroTTS.af',
    "language" TEXT DEFAULT 'en-US',
    "inputTimeoutMs" INTEGER NOT NULL DEFAULT 5000,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "noInputActionJson" JSONB,
    "invalidInputActionJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_attendant_menus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auto_attendant_menu_options" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "digit" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionConfigJson" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "auto_attendant_menu_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "phone_number_answering_policies" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "answeringMode" TEXT NOT NULL DEFAULT 'browser',
    "forwardingGroupId" TEXT,
    "primaryDestinationId" TEXT,
    "autoAttendantMenuId" TEXT,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "greetingBeforeForward" BOOLEAN NOT NULL DEFAULT false,
    "greetingText" TEXT,
    "scheduleJson" JSONB,
    "holidayExceptionsJson" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_number_answering_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "phone_call_routing_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phoneNumberId" TEXT,
    "humanCallId" TEXT,
    "inboundCallControlId" TEXT NOT NULL,
    "routingVersion" INTEGER NOT NULL DEFAULT 1,
    "stage" TEXT NOT NULL DEFAULT 'init',
    "stateJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phone_call_routing_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "phone_call_legs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "humanCallId" TEXT,
    "direction" TEXT NOT NULL,
    "callControlId" TEXT NOT NULL,
    "destinationE164" TEXT,
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "billableSeconds" INTEGER,
    "terminationCause" TEXT,
    "metadata" JSONB,

    CONSTRAINT "phone_call_legs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forwarding_setup_drafts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "draftJson" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forwarding_setup_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forwarding_usage_monthly" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "forwardedCalls" INTEGER NOT NULL DEFAULT 0,
    "answeredCalls" INTEGER NOT NULL DEFAULT 0,
    "missedCalls" INTEGER NOT NULL DEFAULT 0,
    "forwardedMinutes" INTEGER NOT NULL DEFAULT 0,
    "bridgedMinutes" INTEGER NOT NULL DEFAULT 0,
    "ivrMinutes" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "forwarding_usage_monthly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "forwarding_destinations_workspaceId_phoneE164_key" ON "forwarding_destinations"("workspaceId", "phoneE164");
CREATE INDEX "forwarding_destinations_workspaceId_enabled_idx" ON "forwarding_destinations"("workspaceId", "enabled");
CREATE INDEX "forwarding_groups_workspaceId_idx" ON "forwarding_groups"("workspaceId");
CREATE UNIQUE INDEX "forwarding_group_members_groupId_destinationId_key" ON "forwarding_group_members"("groupId", "destinationId");
CREATE INDEX "forwarding_group_members_groupId_priority_idx" ON "forwarding_group_members"("groupId", "priority");
CREATE INDEX "auto_attendant_menus_workspaceId_status_idx" ON "auto_attendant_menus"("workspaceId", "status");
CREATE UNIQUE INDEX "auto_attendant_menu_options_menuId_digit_key" ON "auto_attendant_menu_options"("menuId", "digit");
CREATE INDEX "auto_attendant_menu_options_menuId_sortOrder_idx" ON "auto_attendant_menu_options"("menuId", "sortOrder");
CREATE UNIQUE INDEX "phone_number_answering_policies_phoneNumberId_key" ON "phone_number_answering_policies"("phoneNumberId");
CREATE INDEX "phone_number_answering_policies_workspaceId_idx" ON "phone_number_answering_policies"("workspaceId");
CREATE INDEX "phone_call_routing_sessions_inboundCallControlId_idx" ON "phone_call_routing_sessions"("inboundCallControlId");
CREATE INDEX "phone_call_routing_sessions_workspaceId_createdAt_idx" ON "phone_call_routing_sessions"("workspaceId", "createdAt");
CREATE INDEX "phone_call_legs_callControlId_idx" ON "phone_call_legs"("callControlId");
CREATE INDEX "phone_call_legs_sessionId_idx" ON "phone_call_legs"("sessionId");
CREATE UNIQUE INDEX "forwarding_setup_drafts_workspaceId_key" ON "forwarding_setup_drafts"("workspaceId");
CREATE UNIQUE INDEX "forwarding_usage_monthly_workspaceId_yearMonth_key" ON "forwarding_usage_monthly"("workspaceId", "yearMonth");

ALTER TABLE "forwarding_destinations" ADD CONSTRAINT "forwarding_destinations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forwarding_groups" ADD CONSTRAINT "forwarding_groups_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forwarding_group_members" ADD CONSTRAINT "forwarding_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "forwarding_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forwarding_group_members" ADD CONSTRAINT "forwarding_group_members_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "forwarding_destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auto_attendant_menus" ADD CONSTRAINT "auto_attendant_menus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auto_attendant_menu_options" ADD CONSTRAINT "auto_attendant_menu_options_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "auto_attendant_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_number_answering_policies" ADD CONSTRAINT "phone_number_answering_policies_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_number_answering_policies" ADD CONSTRAINT "phone_number_answering_policies_forwardingGroupId_fkey" FOREIGN KEY ("forwardingGroupId") REFERENCES "forwarding_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phone_number_answering_policies" ADD CONSTRAINT "phone_number_answering_policies_autoAttendantMenuId_fkey" FOREIGN KEY ("autoAttendantMenuId") REFERENCES "auto_attendant_menus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "phone_call_routing_sessions" ADD CONSTRAINT "phone_call_routing_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "phone_call_legs" ADD CONSTRAINT "phone_call_legs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "phone_call_routing_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forwarding_setup_drafts" ADD CONSTRAINT "forwarding_setup_drafts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forwarding_usage_monthly" ADD CONSTRAINT "forwarding_usage_monthly_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
