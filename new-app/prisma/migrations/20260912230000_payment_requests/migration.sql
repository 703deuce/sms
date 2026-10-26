-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('draft', 'ready', 'sent', 'delivered', 'opened', 'paid', 'failed', 'expired', 'cancelled', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "PaymentRequestSourceType" AS ENUM ('standalone', 'conversation', 'mctb_conversation', 'appointment', 'other');

-- CreateEnum
CREATE TYPE "PaymentRequestDeliveryStatus" AS ENUM ('not_sent', 'queued', 'sent', 'delivered', 'failed');

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "processor" TEXT NOT NULL DEFAULT 'STRIPE',
    "processorConnectedAccountId" TEXT,
    "customerId" TEXT,
    "contactId" TEXT,
    "customerName" TEXT,
    "customerPhoneE164" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "description" TEXT NOT NULL,
    "customerNote" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'draft',
    "deliveryStatus" "PaymentRequestDeliveryStatus" NOT NULL DEFAULT 'not_sent',
    "processorCheckoutId" TEXT,
    "processorPaymentLinkId" TEXT,
    "processorPaymentIntentId" TEXT,
    "processorChargeId" TEXT,
    "publicToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "amountPaidMinor" INTEGER,
    "amountRefundedMinor" INTEGER DEFAULT 0,
    "sourceType" "PaymentRequestSourceType" NOT NULL DEFAULT 'standalone',
    "sourceId" TEXT,
    "conversationId" TEXT,
    "missedCallId" TEXT,
    "appointmentId" TEXT,
    "messageId" TEXT,
    "createdByUserId" TEXT,
    "lastReminderAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "firstOpenedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "smsError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_request_events" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "actorUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_publicToken_key" ON "payment_requests"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_idempotencyKey_key" ON "payment_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_requests_workspaceId_status_createdAt_idx" ON "payment_requests"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_requests_workspaceId_customerPhoneE164_idx" ON "payment_requests"("workspaceId", "customerPhoneE164");

-- CreateIndex
CREATE INDEX "payment_requests_conversationId_idx" ON "payment_requests"("conversationId");

-- CreateIndex
CREATE INDEX "payment_requests_processorCheckoutId_idx" ON "payment_requests"("processorCheckoutId");

-- CreateIndex
CREATE INDEX "payment_requests_publicToken_idx" ON "payment_requests"("publicToken");

-- CreateIndex
CREATE INDEX "payment_request_events_paymentRequestId_createdAt_idx" ON "payment_request_events"("paymentRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_request_events_workspaceId_createdAt_idx" ON "payment_request_events"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_request_events" ADD CONSTRAINT "payment_request_events_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "payment_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
