-- CreateTable
CREATE TABLE "clip_thumbnails" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "aspect" TEXT NOT NULL,
    "sourceFrameMs" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "titleText" TEXT,
    "imageKey" TEXT,
    "picked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_thumbnails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clip_thumbnails_clipId_idx" ON "clip_thumbnails"("clipId");

-- CreateIndex
CREATE INDEX "clip_thumbnails_workspaceId_idx" ON "clip_thumbnails"("workspaceId");
