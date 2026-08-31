ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "optInMessagesJson" JSONB;
ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "inboxTagsJson" JSONB;
ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "awayInsideMessage" TEXT;
ALTER TABLE workspace_messaging_settings ADD COLUMN IF NOT EXISTS "inboxPermissionsJson" JSONB;
