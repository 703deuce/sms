-- CreateTable
CREATE TABLE "voice_operational_overrides" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agentId" TEXT,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "auditJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_operational_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_operational_overrides_workspaceId_kind_effectiveFrom_idx" ON "voice_operational_overrides"("workspaceId", "kind", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "voice_operational_overrides" ADD CONSTRAINT "voice_operational_overrides_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
