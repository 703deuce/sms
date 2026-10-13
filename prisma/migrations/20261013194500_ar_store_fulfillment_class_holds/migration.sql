-- CreateTable
CREATE TABLE "service_booking_store_fulfillments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_booking_store_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_occurrence_registration_holds" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "contactId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fulfillmentOutcome" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_occurrence_registration_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_booking_store_fulfillments_stripeSessionId_key" ON "service_booking_store_fulfillments"("stripeSessionId");

-- CreateIndex
CREATE INDEX "service_booking_store_fulfillments_workspaceId_createdAt_idx" ON "service_booking_store_fulfillments"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "class_occurrence_registration_holds_stripeCheckoutSessionId_key" ON "class_occurrence_registration_holds"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "class_occurrence_registration_holds_occurrenceId_status_expires_idx" ON "class_occurrence_registration_holds"("occurrenceId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "class_occurrence_registration_holds_workspaceId_expiresAt_idx" ON "class_occurrence_registration_holds"("workspaceId", "expiresAt");

-- AddForeignKey
ALTER TABLE "service_booking_store_fulfillments" ADD CONSTRAINT "service_booking_store_fulfillments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_occurrence_registration_holds" ADD CONSTRAINT "class_occurrence_registration_holds_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_occurrence_registration_holds" ADD CONSTRAINT "class_occurrence_registration_holds_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "class_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
