-- Batch 4 + B3: disposition fields, claims, cadences, callback routing columns

ALTER TABLE "power_dialer_dispositions"
  ADD COLUMN IF NOT EXISTS "outcomeClass" TEXT,
  ADD COLUMN IF NOT EXISTS "colorHex" TEXT,
  ADD COLUMN IF NOT EXISTS "hotkey" TEXT,
  ADD COLUMN IF NOT EXISTS "answerContext" TEXT NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS "actionsJson" JSONB;

CREATE TABLE IF NOT EXISTS "power_dialer_contact_claims" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "repUserId" TEXT,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "power_dialer_contact_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "power_dialer_contact_claims_campaignId_contactId_key"
  ON "power_dialer_contact_claims"("campaignId", "contactId");
CREATE INDEX IF NOT EXISTS "power_dialer_contact_claims_sessionId_idx"
  ON "power_dialer_contact_claims"("sessionId");
CREATE INDEX IF NOT EXISTS "power_dialer_contact_claims_workspaceId_expiresAt_idx"
  ON "power_dialer_contact_claims"("workspaceId", "expiresAt");

CREATE TABLE IF NOT EXISTS "power_dialer_cadences" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "stepsJson" JSONB NOT NULL,
  "stopRulesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "power_dialer_cadences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_cadences_workspaceId_idx"
  ON "power_dialer_cadences"("workspaceId");

ALTER TABLE "power_dialer_cadences"
  ADD CONSTRAINT "power_dialer_cadences_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "power_dialer_cadence_enrollments" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "cadenceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
  "nextStepAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "power_dialer_cadence_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_cadence_enrollments_workspaceId_status_nextStepAt_idx"
  ON "power_dialer_cadence_enrollments"("workspaceId", "status", "nextStepAt");
CREATE INDEX IF NOT EXISTS "power_dialer_cadence_enrollments_contactId_cadenceId_idx"
  ON "power_dialer_cadence_enrollments"("contactId", "cadenceId");

ALTER TABLE "power_dialer_cadence_enrollments"
  ADD CONSTRAINT "power_dialer_cadence_enrollments_cadenceId_fkey"
  FOREIGN KEY ("cadenceId") REFERENCES "power_dialer_cadences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_cadence_enrollments"
  ADD CONSTRAINT "power_dialer_cadence_enrollments_contactId_fkey"
  FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_cadence_enrollments"
  ADD CONSTRAINT "power_dialer_cadence_enrollments_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "power_dialer_callbacks"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "routingPool" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
