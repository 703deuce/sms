-- G3b workspace fonts (Text → Upload font), additive only. The TTF / OTF lives on the clip storage
-- (B2 in prod) at fonts/{workspaceId}/{id}.{ttf|otf}; family + caption-fit metrics are parsed at
-- upload so the worker burn and the editor preview size text the same way. Soft delete only: an
-- old project that used a deleted font still renders with it.
CREATE TABLE IF NOT EXISTS "clip_fonts" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageDriver" TEXT,
  "bytes" INTEGER NOT NULL,
  "metrics" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "clip_fonts_workspace_idx" ON "clip_fonts"("workspaceId");
