-- Appointment Reminders — Microsoft production scheduling + durable reminder dispatch

ALTER TABLE "voice_calendar_connections"
  ADD COLUMN IF NOT EXISTS "nextSyncDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncBackoffUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionRenewDueAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "voice_calendar_connections_ms_sync_due_idx"
  ON "voice_calendar_connections" ("provider", "status", "nextSyncDueAt");

CREATE INDEX IF NOT EXISTS "voice_calendar_connections_ms_renew_due_idx"
  ON "voice_calendar_connections" ("provider", "status", "subscriptionRenewDueAt");

CREATE TABLE IF NOT EXISTS "ar_reminder_dispatches" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "timelineType" TEXT NOT NULL,
  "reminderGeneration" INTEGER NOT NULL,
  "intendedFireAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "claimedAt" TIMESTAMP(3),
  "claimExpiresAt" TIMESTAMP(3),
  "submittingAt" TIMESTAMP(3),
  "providerMessageId" TEXT,
  "telnyxMessageId" TEXT,
  "lastError" TEXT,
  "unknownSince" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ar_reminder_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ar_reminder_dispatches_logical_key"
  ON "ar_reminder_dispatches" ("appointmentId", "timelineType", "reminderGeneration");

CREATE INDEX IF NOT EXISTS "ar_reminder_dispatches_due_idx"
  ON "ar_reminder_dispatches" ("status", "intendedFireAt");

CREATE INDEX IF NOT EXISTS "ar_reminder_dispatches_workspace_idx"
  ON "ar_reminder_dispatches" ("workspaceId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "voice_appointments_reminder_scan_idx"
  ON "voice_appointments" ("status", "startsAt");
