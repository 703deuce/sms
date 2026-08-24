-- Align supplemental migration column names with Prisma (camelCase @@map columns).
-- Fixes snake_case columns introduced in 20260823_transovo_platform_features.sql.
-- Safe to re-run (idempotent renames / IF NOT EXISTS adds).

-- missed_call_text_configs: merge duplicate snake → camel, drop snake
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'missed_call_text_configs'
      AND column_name = 'message_template_business_hours'
  ) THEN
    UPDATE missed_call_text_configs
      SET "messageTemplateBusinessHours" = message_template_business_hours
      WHERE "messageTemplateBusinessHours" IS NULL
        AND message_template_business_hours IS NOT NULL;
    ALTER TABLE missed_call_text_configs DROP COLUMN message_template_business_hours;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'missed_call_text_configs'
      AND column_name = 'message_template_after_hours'
  ) THEN
    UPDATE missed_call_text_configs
      SET "messageTemplateAfterHours" = message_template_after_hours
      WHERE "messageTemplateAfterHours" IS NULL
        AND message_template_after_hours IS NOT NULL;
    ALTER TABLE missed_call_text_configs DROP COLUMN message_template_after_hours;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'missed_call_text_configs'
      AND column_name = 'require_carrier_forward'
  ) THEN
    UPDATE missed_call_text_configs
      SET "requireCarrierForward" = require_carrier_forward
      WHERE "requireCarrierForward" IS DISTINCT FROM require_carrier_forward;
    ALTER TABLE missed_call_text_configs DROP COLUMN require_carrier_forward;
  END IF;
END $$;

-- voicemail_messages: merge duplicate snake → camel, drop snake
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'voicemail_messages'
      AND column_name = 'internal_notes'
  ) THEN
    UPDATE voicemail_messages
      SET "internalNotes" = internal_notes
      WHERE "internalNotes" IS NULL AND internal_notes IS NOT NULL;
    ALTER TABLE voicemail_messages DROP COLUMN internal_notes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'voicemail_messages'
      AND column_name = 'is_resolved'
  ) THEN
    UPDATE voicemail_messages
      SET "isResolved" = is_resolved
      WHERE "isResolved" IS DISTINCT FROM is_resolved;
    ALTER TABLE voicemail_messages DROP COLUMN is_resolved;
  END IF;
END $$;

-- Transovo product features (from 20260825 — idempotent if already applied)
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
