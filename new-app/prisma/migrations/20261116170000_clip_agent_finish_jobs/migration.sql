-- Clip-specific AI finishing bridge. Additive, isolated from Motion Studio jobs.
CREATE TABLE "clip_agent_finish_jobs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'dispatching',
  "phase" TEXT NOT NULL DEFAULT 'dispatch',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "artifacts" JSONB NOT NULL DEFAULT '[]',
  "resultKey" TEXT,
  "durationMs" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "clip_agent_finish_jobs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clip_agent_finish_jobs_clipId_idempotencyKey_key"
  ON "clip_agent_finish_jobs"("clipId", "idempotencyKey");
CREATE INDEX "clip_agent_finish_jobs_workspaceId_projectId_createdAt_idx"
  ON "clip_agent_finish_jobs"("workspaceId", "projectId", "createdAt");
CREATE INDEX "clip_agent_finish_jobs_clipId_createdAt_idx"
  ON "clip_agent_finish_jobs"("clipId", "createdAt");
