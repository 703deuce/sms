-- Appointment waitlist + recurring series support

CREATE TABLE IF NOT EXISTS appointment_waitlist_entries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id TEXT,
  appointment_type_id TEXT,
  service_name TEXT,
  preferred_date TEXT,
  preferred_time_start TEXT,
  preferred_time_end TEXT,
  staff_preference TEXT,
  location_id TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_waitlist_ws_status_idx
  ON appointment_waitlist_entries (workspace_id, status);

CREATE TABLE IF NOT EXISTS appointment_recurring_series (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id TEXT,
  service_name TEXT NOT NULL,
  frequency TEXT NOT NULL,
  occurrences INTEGER,
  end_date TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointment_recurring_series_ws_idx
  ON appointment_recurring_series (workspace_id);
