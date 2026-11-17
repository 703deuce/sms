-- Legacy paused jobs predate waitingStartedAt. Anchor their deadline to the
-- last known update rather than leave them indefinitely waiting.
UPDATE "MotionStudioAgentJob"
SET "waitingStartedAt" = COALESCE("waitingStartedAt", "updatedAt")
WHERE "status" = 'needs_input' AND "waitingStartedAt" IS NULL;
