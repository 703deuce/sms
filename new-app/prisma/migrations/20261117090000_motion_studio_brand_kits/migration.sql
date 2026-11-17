-- Workspace-scoped reusable brand profiles. Projects snapshot profiles into their settings.
CREATE TABLE IF NOT EXISTS "MotionStudioBrandKit" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "profile" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MotionStudioBrandKit_workspaceId_idx" ON "MotionStudioBrandKit" ("workspaceId");
