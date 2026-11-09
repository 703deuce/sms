-- AI Motion Graphics: additive workspace-scoped style profiles.
-- No changes to existing clips, rendering, or legacy application tables.
CREATE TABLE IF NOT EXISTS "motion_style_profiles" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "motion_style_profiles_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "motion_style_profiles_workspaceId_deletedAt_idx"
  ON "motion_style_profiles"("workspaceId", "deletedAt");
