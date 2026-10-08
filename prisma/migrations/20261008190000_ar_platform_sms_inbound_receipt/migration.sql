-- Durable platform SMS inbound receipt (Telnyx/Twilio → AR pipeline traceability)

CREATE TYPE "ArPlatformSmsInboundReceiptState" AS ENUM (
  'RECEIVED',
  'ROUTED',
  'PROCESSING',
  'COMPLETED',
  'RETRY_PENDING',
  'HELD',
  'FAILED'
);

CREATE TABLE "ar_platform_sms_inbound_receipts" (
  "id" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "fromE164" TEXT NOT NULL,
  "toE164" TEXT NOT NULL,
  "platformPhoneNumberId" TEXT,
  "bodyPreview" TEXT NOT NULL,
  "state" "ArPlatformSmsInboundReceiptState" NOT NULL DEFAULT 'RECEIVED',
  "routingResolution" TEXT,
  "replySessionId" TEXT,
  "conversationId" TEXT,
  "processInboundJobId" TEXT,
  "outboundMessageId" TEXT,
  "holdReason" TEXT,
  "lastError" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ar_platform_sms_inbound_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ar_platform_sms_inbound_receipts_providerMessageId_key"
  ON "ar_platform_sms_inbound_receipts"("providerMessageId");

CREATE INDEX "ar_platform_sms_inbound_receipts_fromE164_receivedAt_idx"
  ON "ar_platform_sms_inbound_receipts"("fromE164", "receivedAt");

CREATE INDEX "ar_platform_sms_inbound_receipts_state_receivedAt_idx"
  ON "ar_platform_sms_inbound_receipts"("state", "receivedAt");
