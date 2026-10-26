-- CreateTable
CREATE TABLE "ar_sms_consumer_platform_sender_assignments" (
    "id" TEXT NOT NULL,
    "consumerE164" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platformPhoneNumberId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ar_sms_consumer_platform_sender_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ar_sms_consumer_platform_sender_assignments_consumerE164_plat_key" ON "ar_sms_consumer_platform_sender_assignments"("consumerE164", "platformPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "ar_sms_consumer_platform_sender_assignments_consumerE164_work_key" ON "ar_sms_consumer_platform_sender_assignments"("consumerE164", "workspaceId");

-- CreateIndex
CREATE INDEX "ar_sms_consumer_platform_sender_assignments_workspaceId_consum_idx" ON "ar_sms_consumer_platform_sender_assignments"("workspaceId", "consumerE164");

-- AddForeignKey
ALTER TABLE "ar_sms_consumer_platform_sender_assignments" ADD CONSTRAINT "ar_sms_consumer_platform_sender_assignments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ar_sms_consumer_platform_sender_assignments" ADD CONSTRAINT "ar_sms_consumer_platform_sender_assignments_platformPhoneNumbe_fkey" FOREIGN KEY ("platformPhoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
