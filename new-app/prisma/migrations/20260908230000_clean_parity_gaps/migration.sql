-- CreateTable
CREATE TABLE "booking_contract_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "requireBeforePayment" BOOLEAN NOT NULL DEFAULT false,
    "eligibleTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_booking_contracts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "contactId" TEXT,
    "templateVersion" TEXT NOT NULL,
    "bodySnapshot" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unsigned',
    "signerName" TEXT,
    "signatureDataUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "signTokenHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signed_booking_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_invoices" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "appointmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'open',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "depositPaidCents" INTEGER NOT NULL DEFAULT 0,
    "balanceDueCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "payTokenHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
    "appointmentId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "booking_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_products" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "quantityAvailable" INTEGER,
    "sellStandalone" BOOLEAN NOT NULL DEFAULT true,
    "eligibleTypeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduling_resource_groups" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selectionMode" TEXT NOT NULL DEFAULT 'any_one',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduling_resource_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_admission_tickets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "occurrenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "attendeeName" TEXT,
    "ticketCode" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "checkedInAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_admission_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_contract_templates_workspaceId_active_idx" ON "booking_contract_templates"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "signed_booking_contracts_signTokenHash_key" ON "signed_booking_contracts"("signTokenHash");

-- CreateIndex
CREATE INDEX "signed_booking_contracts_workspaceId_appointmentId_idx" ON "signed_booking_contracts"("workspaceId", "appointmentId");

-- CreateIndex
CREATE INDEX "signed_booking_contracts_workspaceId_contactId_idx" ON "signed_booking_contracts"("workspaceId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_invoices_payTokenHash_key" ON "booking_invoices"("payTokenHash");

-- CreateIndex
CREATE INDEX "booking_invoices_workspaceId_contactId_status_idx" ON "booking_invoices"("workspaceId", "contactId", "status");

-- CreateIndex
CREATE INDEX "booking_invoice_line_items_invoiceId_idx" ON "booking_invoice_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "booking_products_workspaceId_active_idx" ON "booking_products"("workspaceId", "active");

-- CreateIndex
CREATE INDEX "scheduling_resource_groups_workspaceId_active_idx" ON "scheduling_resource_groups"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "class_admission_tickets_qrToken_key" ON "class_admission_tickets"("qrToken");

-- CreateIndex
CREATE INDEX "class_admission_tickets_workspaceId_occurrenceId_idx" ON "class_admission_tickets"("workspaceId", "occurrenceId");

-- CreateIndex
CREATE INDEX "class_admission_tickets_workspaceId_contactId_idx" ON "class_admission_tickets"("workspaceId", "contactId");

-- AddForeignKey
ALTER TABLE "booking_contract_templates" ADD CONSTRAINT "booking_contract_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_booking_contracts" ADD CONSTRAINT "signed_booking_contracts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_booking_contracts" ADD CONSTRAINT "signed_booking_contracts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "booking_contract_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_invoices" ADD CONSTRAINT "booking_invoices_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_invoice_line_items" ADD CONSTRAINT "booking_invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "booking_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_products" ADD CONSTRAINT "booking_products_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduling_resource_groups" ADD CONSTRAINT "scheduling_resource_groups_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_admission_tickets" ADD CONSTRAINT "class_admission_tickets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

