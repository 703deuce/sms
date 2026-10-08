-- CreateEnum
CREATE TYPE "ArSmsInboundHeldState" AS ENUM ('HELD', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ar_sms_inbound_held_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "fromE164" TEXT NOT NULL,
    "toE164" TEXT NOT NULL,
    "platformPhoneNumberId" TEXT,
    "bodyPreview" TEXT NOT NULL,
    "holdReason" TEXT NOT NULL,
    "state" "ArSmsInboundHeldState" NOT NULL DEFAULT 'HELD',
    "candidateContexts" JSONB NOT NULL DEFAULT '[]',
    "resolvedWorkspaceId" TEXT,
    "resolvedProduct" TEXT,
    "resolvedReplySessionId" TEXT,
    "resolvedConversationId" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ar_sms_inbound_held_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ar_sms_inbound_held_messages_providerMessageId_key" ON "ar_sms_inbound_held_messages"("providerMessageId");

-- CreateIndex
CREATE INDEX "ar_sms_inbound_held_messages_workspaceId_state_createdAt_idx" ON "ar_sms_inbound_held_messages"("workspaceId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "ar_sms_inbound_held_messages_fromE164_createdAt_idx" ON "ar_sms_inbound_held_messages"("fromE164", "createdAt");

-- AddForeignKey
ALTER TABLE "ar_sms_inbound_held_messages" ADD CONSTRAINT "ar_sms_inbound_held_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
