-- Partial indexes for batched terminal job_queue pruning (status + completedAt filters).
CREATE INDEX IF NOT EXISTS "job_queue_completed_completedAt_idx"
  ON "job_queue" ("completedAt")
  WHERE "status" = 'completed' AND "completedAt" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "job_queue_failed_terminal_idx"
  ON "job_queue" ("completedAt", "updatedAt")
  WHERE "status" = 'failed';
