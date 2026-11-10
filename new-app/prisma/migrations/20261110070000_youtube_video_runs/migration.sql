-- Additive: Mode 2 YouTube video runs.
CREATE TABLE IF NOT EXISTS "youtube_video_runs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "stage" TEXT,
  "progressPercent" INTEGER,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "instruction" TEXT,
  "clientRequestId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "sources" JSONB NOT NULL DEFAULT '[]',
  "ingested" JSONB NOT NULL DEFAULT '[]',
  "options" JSONB,
  "chosenOptionId" TEXT,
  "creditsEstimated" INTEGER,
  "result" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "youtube_video_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "youtube_video_runs_workspaceId_clientRequestId_key"
  ON "youtube_video_runs"("workspaceId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "youtube_video_runs_workspaceId_status_idx"
  ON "youtube_video_runs"("workspaceId", "status");
