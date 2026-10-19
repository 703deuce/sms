-- Platform Telnyx sender is shared across all workspaces. A customer may receive
-- appointment reminders from multiple businesses on the same platform number.
DROP INDEX IF EXISTS "ar_sms_consumer_platform_sender_assignments_consumerE164_plat_key";

CREATE INDEX IF NOT EXISTS "ar_sms_consumer_platform_sender_assignments_consumer_sender_idx"
  ON "ar_sms_consumer_platform_sender_assignments"("consumerE164", "platformPhoneNumberId");
