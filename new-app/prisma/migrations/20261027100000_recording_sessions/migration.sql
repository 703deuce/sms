-- LiveKit recording sessions (M14) — additive only

CREATE TYPE "RecordingSessionStatus" AS ENUM ('DRAFT', 'LIVE', 'ENDED', 'PROCESSING', 'READY', 'FAILED');

CREATE TYPE "RecordingParticipantRole" AS ENUM ('HOST', 'GUEST');

CREATE TABLE "recording_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "livekitRoom" TEXT NOT NULL,
    "livekitRoomSid" TEXT,
    "status" "RecordingSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "maxParticipants" INTEGER NOT NULL DEFAULT 6,
    "liveStartedAt" TIMESTAMP(3),
    "liveEndedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recording_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recording_participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "RecordingParticipantRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recording_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recording_webhook_events" (
    "id" TEXT NOT NULL,
    "livekitEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT,

    CONSTRAINT "recording_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recording_sessions_livekitRoom_key" ON "recording_sessions"("livekitRoom");

CREATE INDEX "recording_sessions_workspaceId_status_idx" ON "recording_sessions"("workspaceId", "status");

CREATE INDEX "recording_participants_sessionId_idx" ON "recording_participants"("sessionId");

CREATE UNIQUE INDEX "recording_webhook_events_livekitEventId_key" ON "recording_webhook_events"("livekitEventId");

ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recording_sessions" ADD CONSTRAINT "recording_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recording_participants" ADD CONSTRAINT "recording_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "recording_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recording_webhook_events" ADD CONSTRAINT "recording_webhook_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "recording_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
