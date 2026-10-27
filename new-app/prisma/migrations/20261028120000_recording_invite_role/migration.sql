-- Add invite role for guest vs producer links (§23)
ALTER TABLE "recording_invites" ADD COLUMN IF NOT EXISTS "role" "RecordingParticipantRole" NOT NULL DEFAULT 'GUEST';
