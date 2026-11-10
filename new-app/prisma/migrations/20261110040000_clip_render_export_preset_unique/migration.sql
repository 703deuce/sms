-- Additive only: optional preset on clip_renders plus a unique index so
-- clip-agent auto-export (clipId + editsVersionHash + preset) is atomic.
-- Existing rows keep preset NULL; PostgreSQL treats NULLs as distinct in
-- unique indexes, so historical renders are not rejected.
ALTER TABLE "clip_renders" ADD COLUMN IF NOT EXISTS "preset" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "clip_renders_clipId_editsVersionHash_preset_key"
  ON "clip_renders" ("clipId", "editsVersionHash", "preset");
