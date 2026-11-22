-- Additive only: clipper producer assignments share the Motion Studio worker registry.
ALTER TABLE "clip_agent_finish_jobs"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'clips',
  ADD COLUMN "input" JSONB,
  ADD COLUMN "workerId" TEXT,
  ADD COLUMN "leaseHash" TEXT,
  ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "failReason" TEXT,
  ADD COLUMN "costReport" JSONB;
CREATE INDEX "clip_agent_finish_jobs_status_createdAt_idx"
  ON "clip_agent_finish_jobs"("status", "createdAt");
CREATE INDEX "clip_agent_finish_jobs_workerId_leaseExpiresAt_idx"
  ON "clip_agent_finish_jobs"("workerId", "leaseExpiresAt");
