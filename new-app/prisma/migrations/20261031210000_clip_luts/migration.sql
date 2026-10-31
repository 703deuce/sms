-- G4a imported color LUTs (Color → LUT → Import .cube), additive only. The .cube text lives on the
-- clip storage (B2 in prod) at luts/{workspaceId}/{id}.cube; it is validated at upload with the
-- same parser the worker and the preview use (3D, size 2..65). Soft delete only: an old project
-- that uses a deleted LUT still renders with it.
CREATE TABLE IF NOT EXISTS "clip_luts" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageDriver" TEXT,
  "bytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "clip_luts_workspace_idx" ON "clip_luts"("workspaceId");
