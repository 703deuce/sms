-- Power Dialer Phase 6: internal DNC, compliance audit, integration sync log

CREATE TABLE "power_dialer_internal_dnc" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    CONSTRAINT "power_dialer_internal_dnc_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "power_dialer_compliance_audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detailJson" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "power_dialer_compliance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "power_dialer_integration_sync_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "attemptId" TEXT,
    "humanCallId" TEXT,
    "contactId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "externalId" TEXT,
    "recordsAffected" INTEGER NOT NULL DEFAULT 0,
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "power_dialer_integration_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "power_dialer_internal_dnc_workspaceId_phone_key" ON "power_dialer_internal_dnc"("workspaceId", "phone");
CREATE INDEX "power_dialer_internal_dnc_workspaceId_idx" ON "power_dialer_internal_dnc"("workspaceId");
CREATE INDEX "power_dialer_compliance_audit_logs_workspaceId_createdAt_idx" ON "power_dialer_compliance_audit_logs"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "power_dialer_integration_sync_logs_idempotencyKey_key" ON "power_dialer_integration_sync_logs"("idempotencyKey");
CREATE INDEX "power_dialer_integration_sync_logs_workspaceId_createdAt_idx" ON "power_dialer_integration_sync_logs"("workspaceId", "createdAt");
CREATE INDEX "power_dialer_integration_sync_logs_workspaceId_provider_idx" ON "power_dialer_integration_sync_logs"("workspaceId", "provider");
CREATE INDEX "power_dialer_integration_sync_logs_attemptId_idx" ON "power_dialer_integration_sync_logs"("attemptId");

ALTER TABLE "power_dialer_internal_dnc" ADD CONSTRAINT "power_dialer_internal_dnc_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_compliance_audit_logs" ADD CONSTRAINT "power_dialer_compliance_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_integration_sync_logs" ADD CONSTRAINT "power_dialer_integration_sync_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
