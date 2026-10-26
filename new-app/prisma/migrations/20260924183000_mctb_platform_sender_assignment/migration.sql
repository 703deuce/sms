-- CreateEnum
CREATE TYPE "MctbPlatformSenderAssignmentState" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "mctb_platform_sender_assignments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "consumerE164" TEXT NOT NULL,
    "platformPhoneNumberId" TEXT NOT NULL,
    "conversationId" TEXT,
    "missedCallEventId" TEXT,
    "state" "MctbPlatformSenderAssignmentState" NOT NULL DEFAULT 'ACTIVE',
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "mctb_platform_sender_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mctb_platform_sender_assignments_workspaceId_consumerE164_idx" ON "mctb_platform_sender_assignments"("workspaceId", "consumerE164");

-- CreateIndex
CREATE INDEX "mctb_platform_sender_assignments_platformPhoneNumberId_consume_idx" ON "mctb_platform_sender_assignments"("platformPhoneNumberId", "consumerE164", "state");

-- At most one ACTIVE owner per (consumer, platform sender).
CREATE UNIQUE INDEX "mctb_platform_sender_assignments_active_pair_key"
ON "mctb_platform_sender_assignments" ("consumerE164", "platformPhoneNumberId")
WHERE "state" = 'ACTIVE';

-- AddForeignKey
ALTER TABLE "mctb_platform_sender_assignments" ADD CONSTRAINT "mctb_platform_sender_assignments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mctb_platform_sender_assignments" ADD CONSTRAINT "mctb_platform_sender_assignments_platformPhoneNumberId_fkey" FOREIGN KEY ("platformPhoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mctb_platform_sender_assignments" ADD CONSTRAINT "mctb_platform_sender_assignments_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
