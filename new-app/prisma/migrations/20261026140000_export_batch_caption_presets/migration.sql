ALTER TABLE "clip_renders" ADD COLUMN IF NOT EXISTS "aspectRatio" TEXT NOT NULL DEFAULT '9:16';
ALTER TABLE "clip_renders" ADD COLUMN IF NOT EXISTS "batchId" TEXT;

CREATE INDEX IF NOT EXISTS "clip_renders_batchId_idx" ON "clip_renders"("batchId");

CREATE TABLE IF NOT EXISTS "caption_presets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caption_presets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "caption_presets_workspaceId_idx" ON "caption_presets"("workspaceId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Workspace'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'caption_presets_workspaceId_fkey'
  ) THEN
    ALTER TABLE "caption_presets"
      ADD CONSTRAINT "caption_presets_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
