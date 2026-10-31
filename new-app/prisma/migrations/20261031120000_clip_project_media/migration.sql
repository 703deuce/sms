-- E5 project media library (additive only): the user's own uploads (video / image / audio) attached
-- to a clip project for the Media panel, B-roll "Upload" tab, music / SFX lanes and multicam angles.
-- Files stay in clip_uploads (same bucket, signed uploads and limits); this only links them to a
-- project and stores probe metadata + the audio-sync result of an uploaded angle.
CREATE TABLE IF NOT EXISTS "clip_project_media" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "clip_projects"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL REFERENCES "clip_uploads"("id") ON DELETE CASCADE,
  "mediaType" TEXT NOT NULL,
  "label" TEXT,
  "durationMs" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "hasAudio" BOOLEAN,
  "syncOffsetMs" INTEGER,
  "syncConfidence" DOUBLE PRECISION,
  "syncStatus" TEXT NOT NULL DEFAULT 'none',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "clip_project_media_project_upload_key" ON "clip_project_media"("projectId", "uploadId");
CREATE INDEX IF NOT EXISTS "clip_project_media_workspace_idx" ON "clip_project_media"("workspaceId");
