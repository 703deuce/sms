-- CreateEnum
CREATE TYPE "PlatformProductConsumerSource" AS ENUM ('mass_text', 'review_requests');

-- AlterEnum
ALTER TYPE "MessagingProductUseCase" ADD VALUE 'REVIEW_SOLICITATION';

-- CreateTable
CREATE TABLE "platform_product_consumer_assignments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "consumerE164" TEXT NOT NULL,
    "platformPhoneNumberId" TEXT NOT NULL,
    "product" "PlatformProductConsumerSource" NOT NULL,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_product_consumer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_product_consumer_assignments_consumerE164_platformPhoneNumberId_product_key" ON "platform_product_consumer_assignments"("consumerE164", "platformPhoneNumberId", "product");

-- CreateIndex
CREATE INDEX "platform_product_consumer_assignments_workspaceId_consumerE164_idx" ON "platform_product_consumer_assignments"("workspaceId", "consumerE164");

-- CreateIndex
CREATE INDEX "platform_product_consumer_assignments_platformPhoneNumberId_consumerE164_product_idx" ON "platform_product_consumer_assignments"("platformPhoneNumberId", "consumerE164", "product");

-- AddForeignKey
ALTER TABLE "platform_product_consumer_assignments" ADD CONSTRAINT "platform_product_consumer_assignments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_product_consumer_assignments" ADD CONSTRAINT "platform_product_consumer_assignments_platformPhoneNumberId_fkey" FOREIGN KEY ("platformPhoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_product_consumer_assignments" ADD CONSTRAINT "platform_product_consumer_assignments_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
