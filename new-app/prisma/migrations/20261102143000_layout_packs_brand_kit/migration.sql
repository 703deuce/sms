CREATE TABLE IF NOT EXISTS "layout_packs" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "aspect"      TEXT NOT NULL DEFAULT '9:16',
  "payload"     JSONB NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "layout_packs_workspaceId_fkey" FOREIGN KEY ("workspaceId")
    REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "layout_packs_workspaceId_idx" ON "layout_packs"("workspaceId");

ALTER TABLE "clip_brand_templates"
  ADD COLUMN IF NOT EXISTS "headingFont" TEXT,
  ADD COLUMN IF NOT EXISTS "captionFont" TEXT,
  ADD COLUMN IF NOT EXISTS "palette" JSONB,
  ADD COLUMN IF NOT EXISTS "watermarkKey" TEXT,
  ADD COLUMN IF NOT EXISTS "watermarkPosition" TEXT DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS "watermarkOpacity" DOUBLE PRECISION DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS "watermarkSizePct" DOUBLE PRECISION DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "aspectOverrides" JSONB;
