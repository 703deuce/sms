CREATE TABLE IF NOT EXISTS "clip_edit_versions" (
  "id" TEXT PRIMARY KEY,
  "clipId" TEXT NOT NULL REFERENCES "clips"("id") ON DELETE CASCADE,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'manual',
  "edits" JSONB NOT NULL,
  "editsSaveVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "clip_edit_versions_clip_created_idx" ON "clip_edit_versions"("clipId","createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "clip_edit_versions_one_original" ON "clip_edit_versions"("clipId") WHERE "kind" = 'original';
