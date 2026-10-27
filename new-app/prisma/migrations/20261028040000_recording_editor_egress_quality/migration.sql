-- Editor solo sessions, cloud backup egress tracks, producer role, transcription flag

CREATE TYPE "RecordingSessionKind" AS ENUM ('ROOM', 'EDITOR_SOLO');

ALTER TABLE "recording_sessions"
  ADD COLUMN "kind" "RecordingSessionKind" NOT NULL DEFAULT 'ROOM',
  ADD COLUMN "cloudBackupEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "transcriptionEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TYPE "RecordingParticipantRole" ADD VALUE IF NOT EXISTS 'PRODUCER';

CREATE TYPE "RecordingTrackQuality" AS ENUM ('HIGH_QUALITY', 'BACKUP');

ALTER TABLE "recording_tracks"
  ADD COLUMN "qualitySource" "RecordingTrackQuality" NOT NULL DEFAULT 'HIGH_QUALITY',
  ADD COLUMN "livekitEgressId" TEXT,
  ADD COLUMN "livekitTrackSid" TEXT;

CREATE INDEX "recording_tracks_takeId_qualitySource_idx" ON "recording_tracks"("takeId", "qualitySource");
