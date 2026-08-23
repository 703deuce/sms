-- Transovo non-Stripe finish: VM summary/SMS notify, box SMS field

ALTER TABLE voicemail_boxes
  ADD COLUMN IF NOT EXISTS "smsNotifyE164" TEXT;

ALTER TABLE voicemail_messages
  ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
