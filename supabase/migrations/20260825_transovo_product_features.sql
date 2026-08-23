-- Transovo product features: availability, assignment, answer confirmation

ALTER TABLE smart_routing_destinations
  ADD COLUMN IF NOT EXISTS "availabilityStatus" TEXT NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS "unavailableUntil" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "answerConfirmationEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE voicemail_messages
  ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;

ALTER TABLE callback_requests
  ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "voicemailMessageId" TEXT;

CREATE INDEX IF NOT EXISTS voicemail_messages_workspace_assigned_idx
  ON voicemail_messages ("workspaceId", "assignedToUserId");

CREATE INDEX IF NOT EXISTS smart_routing_destinations_workspace_assigned_idx
  ON smart_routing_destinations ("workspaceId", "assignedUserId");
