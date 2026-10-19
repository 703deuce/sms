-- Durable Voice V3-equivalent reschedule workflow state for AR SMS sessions.
ALTER TABLE "ar_sms_reply_sessions"
ADD COLUMN IF NOT EXISTS "rescheduleWorkflowState" JSONB;
