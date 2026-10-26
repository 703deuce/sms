-- Reputation / Reviews platform (ported from Local SEO Express)
-- Tenant scope: workspace_id stored in business_id + organization_id columns (cuid strings).

CREATE TABLE IF NOT EXISTS reputation_workspace_profile (
  workspace_id TEXT PRIMARY KEY,
  google_place_id TEXT,
  review_link_place_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_reviews (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  competitor_id TEXT,
  source_provider TEXT NOT NULL DEFAULT 'google',
  source_review_id TEXT,
  reviewer_name TEXT,
  rating NUMERIC,
  review_text TEXT,
  review_date DATE,
  relative_date_text TEXT,
  owner_response_text TEXT,
  owner_responded_at TIMESTAMPTZ,
  review_url TEXT,
  published_at TIMESTAMPTZ,
  last_edited_at TIMESTAMPTZ,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_precision TEXT NOT NULL DEFAULT 'unknown',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  absent_pull_count INT NOT NULL DEFAULT 0,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_reviews_workspace
  ON business_reviews (business_id, published_at DESC NULLS LAST)
  WHERE is_deleted = false;

CREATE TABLE IF NOT EXISTS review_sync_state (
  business_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_request_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'both')),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_request_contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  opt_out_reason TEXT,
  last_requested_at TIMESTAMPTZ,
  review_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_contacts_workspace
  ON review_request_contacts (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_request_campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  channel TEXT NOT NULL DEFAULT 'both',
  template_id TEXT REFERENCES review_request_templates(id) ON DELETE SET NULL,
  daily_send_limit INT NOT NULL DEFAULT 10,
  send_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  send_window_start TEXT NOT NULL DEFAULT '10:00',
  send_window_end TEXT NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  duplicate_protection_days INT NOT NULL DEFAULT 90,
  start_date DATE,
  consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_request_recipients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_request_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES review_request_recipients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  tracking_token TEXT NOT NULL UNIQUE,
  tracking_url TEXT NOT NULL,
  google_review_url TEXT NOT NULL,
  subject TEXT,
  message_body TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_request_sends (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  contact_id TEXT,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  tracking_token TEXT,
  phone TEXT,
  email TEXT,
  message_body TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reputation_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  body TEXT,
  recommended_action TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_notification_settings (
  business_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  new_review BOOLEAN NOT NULL DEFAULT true,
  negative_review BOOLEAN NOT NULL DEFAULT true,
  velocity_drop BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reputation_settings (
  business_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_momentum_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  lookback_days INT NOT NULL DEFAULT 90,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  ai_summary TEXT,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_qr_campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  placement_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  tracking_token TEXT NOT NULL UNIQUE,
  scan_count INT NOT NULL DEFAULT 0,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
