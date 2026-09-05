-- Transovo Fax + Verify product tables

ALTER TYPE "WorkspaceProductFeatureKey" ADD VALUE IF NOT EXISTS 'FAX';
ALTER TYPE "WorkspaceProductFeatureKey" ADD VALUE IF NOT EXISTS 'VERIFY';

CREATE TABLE IF NOT EXISTS fax_accounts (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  notify_email TEXT,
  notify_on_inbound BOOLEAN NOT NULL DEFAULT true,
  notify_on_failed_outbound BOOLEAN NOT NULL DEFAULT true,
  auto_analyze_inbound BOOLEAN NOT NULL DEFAULT true,
  auto_classify BOOLEAN NOT NULL DEFAULT true,
  auto_extract BOOLEAN NOT NULL DEFAULT true,
  auto_detect_priority BOOLEAN NOT NULL DEFAULT true,
  auto_detect_spam BOOLEAN NOT NULL DEFAULT true,
  pages_included INTEGER NOT NULL DEFAULT 200,
  pages_used_this_period INTEGER NOT NULL DEFAULT 0,
  overage_pages INTEGER NOT NULL DEFAULT 0,
  usage_period_start TIMESTAMPTZ,
  usage_period_end TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  number_status TEXT NOT NULL DEFAULT 'none',
  metadata_json JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("workspaceId")
);

CREATE TABLE IF NOT EXISTS fax_numbers (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "faxAccountId" TEXT NOT NULL REFERENCES fax_accounts(id) ON DELETE CASCADE,
  "phoneNumberId" TEXT REFERENCES "PhoneNumber"(id) ON DELETE SET NULL,
  e164 TEXT NOT NULL,
  label TEXT,
  telnyx_number_id TEXT,
  telnyx_connection_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  provisioned_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fax_numbers_workspace_idx ON fax_numbers ("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS fax_numbers_e164_idx ON fax_numbers (e164);

CREATE TABLE IF NOT EXISTS fax_transmissions (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "faxAccountId" TEXT NOT NULL REFERENCES fax_accounts(id) ON DELETE CASCADE,
  "faxNumberId" TEXT REFERENCES fax_numbers(id) ON DELETE SET NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  from_e164 TEXT,
  to_e164 TEXT,
  recipient_name TEXT,
  page_count INTEGER,
  telnyx_fax_id TEXT,
  failure_reason TEXT,
  failure_code TEXT,
  document_storage_bucket TEXT,
  document_storage_path TEXT,
  document_mime_type TEXT,
  document_filename TEXT,
  document_size_bytes INTEGER,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  parent_transmission_id TEXT,
  folder TEXT DEFAULT 'inbox',
  priority TEXT DEFAULT 'normal',
  is_spam BOOLEAN NOT NULL DEFAULT false,
  assigned_to_user_id TEXT,
  tags_json JSONB DEFAULT '[]',
  metadata_json JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fax_transmissions_workspace_created_idx ON fax_transmissions ("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS fax_transmissions_telnyx_idx ON fax_transmissions (telnyx_fax_id);
CREATE INDEX IF NOT EXISTS fax_transmissions_status_idx ON fax_transmissions ("workspaceId", status);

CREATE TABLE IF NOT EXISTS fax_webhook_events (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT,
  telnyx_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  telnyx_fax_id TEXT,
  "faxTransmissionId" TEXT,
  payload_json JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fax_intelligence (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "faxTransmissionId" TEXT NOT NULL UNIQUE REFERENCES fax_transmissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_text TEXT,
  extraction_method TEXT,
  ocr_confidence DOUBLE PRECISION,
  ai_summary TEXT,
  document_type TEXT,
  classification_confidence DOUBLE PRECISION,
  structured_data_json JSONB,
  corrected_data_json JSONB,
  priority TEXT,
  priority_reason TEXT,
  spam_score DOUBLE PRECISION,
  spam_reason TEXT,
  search_text TEXT,
  model_version TEXT,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fax_intelligence_search_idx ON fax_intelligence USING gin (to_tsvector('english', coalesce(search_text, '')));

CREATE TABLE IF NOT EXISTS fax_extraction_templates (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document_category TEXT,
  fields_json JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fax_automation_rules (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  conditions_json JSONB NOT NULL DEFAULT '[]',
  actions_json JSONB NOT NULL DEFAULT '[]',
  last_run_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fax_contacts (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  fax_e164 TEXT NOT NULL,
  phone_e164 TEXT,
  email TEXT,
  notes TEXT,
  group_name TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fax_contacts_workspace_idx ON fax_contacts ("workspaceId");

CREATE TABLE IF NOT EXISTS fax_blocked_senders (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  fax_e164 TEXT NOT NULL,
  reason TEXT,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("workspaceId", fax_e164)
);

CREATE TABLE IF NOT EXISTS fax_activity_log (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "faxTransmissionId" TEXT NOT NULL REFERENCES fax_transmissions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  metadata_json JSONB DEFAULT '{}',
  actor_user_id TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fax_activity_transmission_idx ON fax_activity_log ("faxTransmissionId", "createdAt");

CREATE TABLE IF NOT EXISTS fax_comments (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "faxTransmissionId" TEXT NOT NULL REFERENCES fax_transmissions(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verify_credit_ledger (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  stripe_session_id TEXT,
  idempotency_key TEXT UNIQUE,
  description TEXT,
  metadata_json JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verify_credit_ledger_workspace_idx ON verify_credit_ledger ("workspaceId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS verify_credit_reservations (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "bulkJobId" TEXT,
  reserved_credits INTEGER NOT NULL,
  consumed_credits INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verify_lookups (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  input_raw TEXT NOT NULL,
  normalized_e164 TEXT,
  line_type TEXT,
  carrier TEXT,
  country TEXT,
  ported TEXT,
  lookup_status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT DEFAULT 'telnyx',
  provider_response_json JSONB,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  "bulkJobId" TEXT,
  error_message TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verify_lookups_workspace_idx ON verify_lookups ("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS verify_lookups_normalized_idx ON verify_lookups (normalized_e164);

CREATE TABLE IF NOT EXISTS verify_lookup_cache (
  id TEXT PRIMARY KEY,
  normalized_e164 TEXT NOT NULL UNIQUE,
  line_type TEXT,
  carrier TEXT,
  country TEXT,
  ported TEXT,
  provider_response_json JSONB,
  provider TEXT DEFAULT 'telnyx',
  expires_at TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verify_bulk_jobs (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  filename TEXT,
  phone_column TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  unique_numbers INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  successful_lookups INTEGER NOT NULL DEFAULT 0,
  failed_lookups INTEGER NOT NULL DEFAULT 0,
  credits_reserved INTEGER NOT NULL DEFAULT 0,
  credits_consumed INTEGER NOT NULL DEFAULT 0,
  "reservationId" TEXT,
  error_message TEXT,
  completed_at TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verify_bulk_jobs_workspace_idx ON verify_bulk_jobs ("workspaceId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS verify_bulk_job_rows (
  id TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"(id) ON DELETE CASCADE,
  "bulkJobId" TEXT NOT NULL REFERENCES verify_bulk_jobs(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  input_raw TEXT,
  normalized_e164 TEXT,
  "lookupId" TEXT REFERENCES verify_lookups(id) ON DELETE SET NULL,
  original_data_json JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verify_bulk_job_rows_job_idx ON verify_bulk_job_rows ("bulkJobId", row_index);
