-- Recording invites, takes, tracks, multipart parts (M14–M16) — additive only

CREATE TYPE "RecordingTrackKind" AS ENUM ('CAMERA', 'MICROPHONE', 'SCREEN', 'SCREEN_AUDIO');

CREATE TYPE "RecordingTrackStatus" AS ENUM ('RECORDING', 'FINALIZED', 'UPLOADING', 'UPLOADED', 'FAILED');

CREATE TABLE "recording_invites" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recording_takes" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "startAtHostMs" BIGINT NOT NULL,
    "stopAtHostMs" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_takes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recording_tracks" (
    "id" TEXT NOT NULL,
    "takeId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "kind" "RecordingTrackKind" NOT NULL,
    "segmentIndex" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL,
    "sampleRate" INTEGER,
    "actualStartHostMs" BIGINT,
    "status" "RecordingTrackStatus" NOT NULL DEFAULT 'RECORDING',
    "storageKey" TEXT,
    "s3UploadId" TEXT,
    "bytesExpected" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recording_tracks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recording_track_upload_parts" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "etag" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "chunkSeqFrom" INTEGER,
    "chunkSeqTo" INTEGER,

    CONSTRAINT "recording_track_upload_parts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "recording_participants" ADD COLUMN "livekitSid" TEXT;
ALTER TABLE "recording_participants" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'INVITED';
ALTER TABLE "recording_participants" ADD COLUMN "clockOffsetMs" DOUBLE PRECISION;

CREATE UNIQUE INDEX "recording_invites_tokenHash_key" ON "recording_invites"("tokenHash");

CREATE INDEX "recording_invites_sessionId_idx" ON "recording_invites"("sessionId");

CREATE UNIQUE INDEX "recording_takes_sessionId_index_key" ON "recording_takes"("sessionId", "index");

CREATE INDEX "recording_tracks_takeId_idx" ON "recording_tracks"("takeId");

CREATE INDEX "recording_tracks_participantId_idx" ON "recording_tracks"("participantId");

CREATE UNIQUE INDEX "recording_track_upload_parts_trackId_partNumber_key" ON "recording_track_upload_parts"("trackId", "partNumber");

ALTER TABLE "recording_invites" ADD CONSTRAINT "recording_invites_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "recording_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recording_takes" ADD CONSTRAINT "recording_takes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "recording_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recording_tracks" ADD CONSTRAINT "recording_tracks_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "recording_takes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recording_tracks" ADD CONSTRAINT "recording_tracks_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "recording_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recording_track_upload_parts" ADD CONSTRAINT "recording_track_upload_parts_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "recording_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
