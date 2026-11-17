-- A producer can release CPU resources and resume from saved state on a different worker.
-- Existing rows are unchanged; only new checkpoint data is optional.
ALTER TABLE "MotionStudioAgentJob" ADD COLUMN IF NOT EXISTS "checkpoint" JSONB;
