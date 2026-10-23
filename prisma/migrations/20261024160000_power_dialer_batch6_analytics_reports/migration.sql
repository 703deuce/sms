CREATE TABLE IF NOT EXISTS "power_dialer_scheduled_reports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'weekly',
    "reportType" TEXT NOT NULL DEFAULT 'analytics_summary',
    "recipientsJson" JSONB NOT NULL,
    "filtersJson" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "power_dialer_scheduled_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "power_dialer_scheduled_reports_workspaceId_enabled_idx" ON "power_dialer_scheduled_reports"("workspaceId", "enabled");

ALTER TABLE "power_dialer_scheduled_reports" ADD CONSTRAINT "power_dialer_scheduled_reports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
