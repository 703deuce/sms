-- Appointment Reminders product-scoped SMS reply sessions (independent from MCTB assignments).

CREATE TYPE "ArSmsReplySessionState" AS ENUM (
  'AWAITING_REPLY',
  'RESCHEDULING',
  'AWAITING_CANCEL_CONFIRM',
  'AWAITING_STAFF_APPROVAL',
  'COMPLETED',
  'EXPIRED',
  'SENDER_REUSE_BLOCKED',
  'NEEDS_CLARIFICATION',
  'HELD_PENDING_SEND'
);

ALTER TYPE "ConversationProductSource" ADD VALUE IF NOT EXISTS 'APPOINTMENT_REMINDERS';

CREATE TABLE "ar_sms_reply_sessions" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "conversationId" TEXT,
  "platformPhoneNumberId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "consumerE164" TEXT NOT NULL,
  "lifecycleState" "ArSmsReplySessionState" NOT NULL DEFAULT 'AWAITING_REPLY',
  "timelineType" TEXT,
  "calendarConnectionId" TEXT,
  "providerCalendarId" TEXT,
  "providerEventId" TEXT,
  "calendarProvider" TEXT,
  "lastOutboundMessageId" TEXT,
  "lastOutboundProviderMessageId" TEXT,
  "replyEligibleUntil" TIMESTAMP(3),
  "pendingSendReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),

  CONSTRAINT "ar_sms_reply_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ar_sms_reply_sessions_workspaceId_appointmentId_idx" ON "ar_sms_reply_sessions"("workspaceId", "appointmentId");
CREATE INDEX "ar_sms_reply_sessions_consumer_platform_state_idx" ON "ar_sms_reply_sessions"("consumerE164", "platformPhoneNumberId", "lifecycleState");
CREATE INDEX "ar_sms_reply_sessions_workspace_contact_state_idx" ON "ar_sms_reply_sessions"("workspaceId", "contactId", "lifecycleState");

ALTER TABLE "ar_sms_reply_sessions" ADD CONSTRAINT "ar_sms_reply_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ar_sms_reply_sessions" ADD CONSTRAINT "ar_sms_reply_sessions_platformPhoneNumberId_fkey" FOREIGN KEY ("platformPhoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ar_sms_reply_sessions" ADD CONSTRAINT "ar_sms_reply_sessions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
