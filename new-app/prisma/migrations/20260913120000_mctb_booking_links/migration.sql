-- CreateTable
CREATE TABLE "mctb_booking_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mctb_booking_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mctb_booking_links_workspaceId_active_idx" ON "mctb_booking_links"("workspaceId", "active");

-- CreateIndex
CREATE INDEX "mctb_booking_links_workspaceId_isDefault_idx" ON "mctb_booking_links"("workspaceId", "isDefault");

-- AddForeignKey
ALTER TABLE "mctb_booking_links" ADD CONSTRAINT "mctb_booking_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
