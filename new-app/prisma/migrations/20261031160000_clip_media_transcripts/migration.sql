-- E5b on-demand transcription of a project's own media (additive only): an uploaded clip
-- (clip_project_media → clip_uploads) or a Rooms take track (recording_tracks), transcribed by the
-- worker's existing path (Deepgram primary, GPU / local Whisper fallback) only after the user saw
-- and accepted the estimated cost. Words are MEDIA time (seconds, same shape as clip transcripts).
CREATE TABLE IF NOT EXISTS "clip_media_transcripts" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "clip_projects"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "ref" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "words" JSONB,
  "language" TEXT,
  "durationMs" INTEGER,
  "estimatedUsdMicros" INTEGER,
  "costUsdMicros" INTEGER,
  "provider" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "clip_media_transcripts_project_ref_key" ON "clip_media_transcripts"("projectId", "ref", "refId");
CREATE INDEX IF NOT EXISTS "clip_media_transcripts_workspace_idx" ON "clip_media_transcripts"("workspaceId");
