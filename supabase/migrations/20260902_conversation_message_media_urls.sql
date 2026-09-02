-- Persist MMS/media attachment URLs on inbox conversation messages.
ALTER TABLE "ConversationMessage" ADD COLUMN IF NOT EXISTS "mediaUrls" TEXT[] NOT NULL DEFAULT '{}';
