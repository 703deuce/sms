CREATE TABLE IF NOT EXISTS "power_dialer_api_keys" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hashedKey" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "power_dialer_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_api_keys_workspaceId_revokedAt_idx" ON "power_dialer_api_keys"("workspaceId", "revokedAt");
CREATE INDEX IF NOT EXISTS "power_dialer_api_keys_prefix_idx" ON "power_dialer_api_keys"("prefix");

CREATE TABLE IF NOT EXISTS "power_dialer_webhook_endpoints" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "signingSecretHash" TEXT NOT NULL,
    "signingSecretPrefix" TEXT NOT NULL,
    "signingSecretEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_webhook_endpoints_workspaceId_active_idx" ON "power_dialer_webhook_endpoints"("workspaceId", "active");

CREATE TABLE IF NOT EXISTS "power_dialer_webhook_deliveries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "responseExcerpt" TEXT,
    "nextRetryAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3),
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "power_dialer_webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "power_dialer_webhook_deliveries_eventId_key" ON "power_dialer_webhook_deliveries"("eventId");
CREATE INDEX IF NOT EXISTS "power_dialer_webhook_deliveries_workspaceId_createdAt_idx" ON "power_dialer_webhook_deliveries"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "power_dialer_webhook_deliveries_endpointId_status_idx" ON "power_dialer_webhook_deliveries"("endpointId", "status");

CREATE TABLE IF NOT EXISTS "power_dialer_impersonation_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    CONSTRAINT "power_dialer_impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_impersonation_sessions_workspaceId_actorUserId_endedAt_idx" ON "power_dialer_impersonation_sessions"("workspaceId", "actorUserId", "endedAt");

CREATE TABLE IF NOT EXISTS "power_dialer_api_audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "apiKeyId" TEXT,
    "actorUserId" TEXT,
    "impersonatedUserId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "power_dialer_api_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_api_audit_logs_workspaceId_createdAt_idx" ON "power_dialer_api_audit_logs"("workspaceId", "createdAt");

ALTER TABLE "power_dialer_api_keys" ADD CONSTRAINT "power_dialer_api_keys_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_webhook_endpoints" ADD CONSTRAINT "power_dialer_webhook_endpoints_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_webhook_deliveries" ADD CONSTRAINT "power_dialer_webhook_deliveries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_webhook_deliveries" ADD CONSTRAINT "power_dialer_webhook_deliveries_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "power_dialer_webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_impersonation_sessions" ADD CONSTRAINT "power_dialer_impersonation_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "power_dialer_api_audit_logs" ADD CONSTRAINT "power_dialer_api_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
