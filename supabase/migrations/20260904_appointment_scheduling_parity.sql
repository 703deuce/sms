-- Appointment waitlist + recurring series support

CREATE TABLE IF NOT EXISTS appointment_waitlist_entries (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "contactId" TEXT,
  "appointmentTypeId" TEXT,
  "serviceName" TEXT,
  "preferredDate" TEXT,
  "preferredTimeStart" TEXT,
  "preferredTimeEnd" TEXT,
  "staffPreference" TEXT,
  "locationId" TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_waitlist_ws_status_idx
  ON appointment_waitlist_entries ("workspaceId", status);

CREATE TABLE IF NOT EXISTS appointment_recurring_series (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "contactId" TEXT,
  "serviceName" TEXT NOT NULL,
  frequency TEXT NOT NULL,
  occurrences INTEGER,
  "endDate" TIMESTAMPTZ,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_recurring_series_ws_idx
  ON appointment_recurring_series ("workspaceId");
