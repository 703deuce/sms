-- Contact list saved filters
ALTER TABLE "contact_lists" ADD COLUMN IF NOT EXISTS "filtersJson" JSONB NOT NULL DEFAULT '[]';

-- Disposition library
CREATE TABLE "power_dialer_disposition_sets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_disposition_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "power_dialer_dispositions" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'outcome',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requireNotes" BOOLEAN NOT NULL DEFAULT false,
    "markConnected" BOOLEAN NOT NULL DEFAULT false,
    "markContactCompleted" BOOLEAN NOT NULL DEFAULT false,
    "scheduleCallback" BOOLEAN NOT NULL DEFAULT false,
    "removeFromQueue" BOOLEAN NOT NULL DEFAULT false,
    "addToDnc" BOOLEAN NOT NULL DEFAULT false,
    "triggerCrmUpdate" BOOLEAN NOT NULL DEFAULT false,
    "triggerFollowUp" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "power_dialer_dispositions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "power_dialer_scripts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_scripts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "power_dialer_voicemail_drops" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_voicemail_drops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "power_dialer_callbacks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "attemptId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "assignedUserId" TEXT,
    "notes" TEXT,
    "disposition" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_callbacks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "dispositionId" TEXT;
ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "voicemailDropSentAt" TIMESTAMP(3);

CREATE INDEX "power_dialer_disposition_sets_workspaceId_idx" ON "power_dialer_disposition_sets"("workspaceId");
CREATE INDEX "power_dialer_dispositions_setId_sortOrder_idx" ON "power_dialer_dispositions"("setId", "sortOrder");
CREATE INDEX "power_dialer_scripts_workspaceId_idx" ON "power_dialer_scripts"("workspaceId");
CREATE INDEX "power_dialer_voicemail_drops_workspaceId_idx" ON "power_dialer_voicemail_drops"("workspaceId");
CREATE INDEX "power_dialer_callbacks_workspaceId_scheduledAt_idx" ON "power_dialer_callbacks"("workspaceId", "scheduledAt");
CREATE INDEX "power_dialer_callbacks_campaignId_status_idx" ON "power_dialer_callbacks"("campaignId", "status");
CREATE INDEX "power_dialer_callbacks_contactId_idx" ON "power_dialer_callbacks"("contactId");

ALTER TABLE "power_dialer_disposition_sets" ADD CONSTRAINT "power_dialer_disposition_sets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_dispositions" ADD CONSTRAINT "power_dialer_dispositions_setId_fkey" FOREIGN KEY ("setId") REFERENCES "power_dialer_disposition_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_scripts" ADD CONSTRAINT "power_dialer_scripts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_voicemail_drops" ADD CONSTRAINT "power_dialer_voicemail_drops_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_callbacks" ADD CONSTRAINT "power_dialer_callbacks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_callbacks" ADD CONSTRAINT "power_dialer_callbacks_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "power_dialer_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_callbacks" ADD CONSTRAINT "power_dialer_callbacks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_attempts" ADD CONSTRAINT "power_dialer_attempts_dispositionId_fkey" FOREIGN KEY ("dispositionId") REFERENCES "power_dialer_dispositions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill callbacks from legacy attempt.callbackAt
INSERT INTO "power_dialer_callbacks" (
  "id", "workspaceId", "campaignId", "contactId", "attemptId",
  "scheduledAt", "timezone", "status", "notes", "disposition", "createdAt", "updatedAt"
)
SELECT
  'pdcb_' || a."id",
  a."workspaceId",
  s."campaignId",
  a."contactId",
  a."id",
  a."callbackAt",
  COALESCE(c."timezone", camp."timezone", 'America/Chicago'),
  CASE WHEN a."disposition" IS NOT NULL AND lower(a."disposition") LIKE '%callback%' THEN 'scheduled' ELSE 'scheduled' END,
  a."notes",
  a."disposition",
  a."createdAt",
  NOW()
FROM "power_dialer_attempts" a
JOIN "power_dialer_sessions" s ON s."id" = a."sessionId"
JOIN "power_dialer_campaigns" camp ON camp."id" = s."campaignId"
JOIN "contacts" c ON c."id" = a."contactId"
WHERE a."callbackAt" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "power_dialer_callbacks" cb WHERE cb."attemptId" = a."id");
