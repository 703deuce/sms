-- Additive only: keep existing YouTube runs and Producer logs unchanged.
ALTER TABLE "youtube_video_runs" ADD COLUMN IF NOT EXISTS "analysisState" JSONB;

CREATE TABLE IF NOT EXISTS "youtube_video_run_steps" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "stepIndex" INTEGER NOT NULL,
  "phase" TEXT,
  "tool" TEXT NOT NULL,
  "kind" TEXT,
  "argsSummary" TEXT,
  "resultSummary" TEXT,
  "durationMs" INTEGER,
  "tokensIn" INTEGER,
  "tokensOut" INTEGER,
  "estUsd" DOUBLE PRECISION,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "youtube_video_run_steps_runId_stepIndex_idx"
  ON "youtube_video_run_steps"("runId", "stepIndex");
