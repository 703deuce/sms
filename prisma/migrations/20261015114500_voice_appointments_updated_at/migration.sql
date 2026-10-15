-- VoiceAppointment row modification time (AR rescheduler, workspace panels, backfill ordering).
-- Previously code referenced updatedAt but the column did not exist (runtime Prisma 500).

ALTER TABLE "voice_appointments"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE "voice_appointments"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL OR "updatedAt" < "createdAt";

CREATE INDEX IF NOT EXISTS "voice_appointments_workspaceId_updatedAt_idx"
  ON "voice_appointments" ("workspaceId", "updatedAt" DESC);
