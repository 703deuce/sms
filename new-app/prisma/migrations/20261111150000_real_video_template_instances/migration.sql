-- B3 REAL VIDEO TEMPLATES: additive, isolated instance/snapshot persistence.
-- No existing table, value, route, edit, or render cache is altered.
CREATE TABLE "clip_video_template_instances" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "projectId" TEXT,
  "clipId" TEXT,
  "familyId" TEXT NOT NULL,
  "familyRevision" INTEGER NOT NULL,
  "designId" TEXT NOT NULL,
  "designRevision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "authoringState" JSONB NOT NULL,
  "authoringVersion" INTEGER NOT NULL DEFAULT 0,
  "appliedEditsSaveVersion" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clip_video_template_instances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clip_video_template_instances_projectId_key"
  ON "clip_video_template_instances"("projectId");
CREATE UNIQUE INDEX "clip_video_template_instances_clipId_key"
  ON "clip_video_template_instances"("clipId");
CREATE UNIQUE INDEX "clip_template_instances_ws_idempotency_key"
  ON "clip_video_template_instances"("workspaceId", "idempotencyKey");
CREATE INDEX "clip_template_instances_ws_status_idx"
  ON "clip_video_template_instances"("workspaceId", "status");
ALTER TABLE "clip_video_template_instances"
  ADD CONSTRAINT "clip_video_template_instances_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clip_video_template_instances"
  ADD CONSTRAINT "clip_video_template_instances_clipId_fkey"
  FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
