-- Soft holds for Appointment Booking Agent slot reservation during confirmation.
CREATE TABLE IF NOT EXISTS appointment_slot_holds (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "agentId" TEXT,
  "callId" TEXT,
  "contactId" TEXT,
  phone TEXT,
  "serviceName" TEXT,
  "staffName" TEXT,
  "startsAt" TIMESTAMPTZ NOT NULL,
  "endsAt" TIMESTAMPTZ NOT NULL,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'held',
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "convertedAppointmentId" TEXT,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_slot_holds_workspace_starts_idx
  ON appointment_slot_holds ("workspaceId", "startsAt");
CREATE INDEX IF NOT EXISTS appointment_slot_holds_workspace_status_expires_idx
  ON appointment_slot_holds ("workspaceId", status, "expiresAt");
CREATE INDEX IF NOT EXISTS appointment_slot_holds_call_idx
  ON appointment_slot_holds ("callId");
