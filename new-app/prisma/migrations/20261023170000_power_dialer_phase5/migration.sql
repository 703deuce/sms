-- Power Dialer Phase 5: answer detection events + screening telemetry storage

CREATE TABLE "power_dialer_detection_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "attemptId" TEXT,
    "humanCallId" TEXT,
    "eventType" TEXT NOT NULL,
    "result" TEXT,
    "payload" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "power_dialer_detection_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "power_dialer_detection_events_idempotencyKey_key" ON "power_dialer_detection_events"("idempotencyKey");
CREATE INDEX "power_dialer_detection_events_workspaceId_createdAt_idx" ON "power_dialer_detection_events"("workspaceId", "createdAt");
CREATE INDEX "power_dialer_detection_events_attemptId_idx" ON "power_dialer_detection_events"("attemptId");

ALTER TABLE "power_dialer_detection_events" ADD CONSTRAINT "power_dialer_detection_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
