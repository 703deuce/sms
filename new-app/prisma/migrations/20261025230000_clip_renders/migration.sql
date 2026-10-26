-- CreateTable
CREATE TABLE "clip_renders" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" "ClipRenderStatus" NOT NULL DEFAULT 'READY',
    "outputKey" TEXT,
    "format" TEXT NOT NULL DEFAULT 'mp4',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "filename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_renders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clip_renders_workspaceId_createdAt_idx" ON "clip_renders"("workspaceId", "createdAt");

ALTER TABLE "clip_renders" ADD CONSTRAINT "clip_renders_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clip_renders" ADD CONSTRAINT "clip_renders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
