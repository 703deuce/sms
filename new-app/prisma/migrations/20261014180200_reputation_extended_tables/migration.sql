-- Extended reputation tables referenced by ported Reviews code (Postgres / Prisma).

CREATE TABLE IF NOT EXISTS review_request_links (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  place_id TEXT,
  review_url TEXT NOT NULL,
  short_url TEXT,
  poster_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_request_links_business_active
  ON review_request_links (business_id, is_active);

CREATE TABLE IF NOT EXISTS review_request_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  link_id TEXT,
  send_id TEXT,
  event_type TEXT NOT NULL,
  channel TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  service_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_request_replies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  campaign_id TEXT,
  recipient_id TEXT,
  send_id TEXT,
  message_id TEXT,
  channel TEXT,
  from_address TEXT,
  from_phone TEXT,
  body TEXT NOT NULL,
  provider_sid TEXT,
  provider_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_request_replies_provider_sid
  ON review_request_replies (provider_sid)
  WHERE provider_sid IS NOT NULL;

ALTER TABLE review_request_templates ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE review_request_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS review_momentum_entities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id TEXT NOT NULL REFERENCES review_momentum_runs(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  competitor_id TEXT,
  metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  unavailable BOOLEAN NOT NULL DEFAULT false,
  velocity_warning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_momentum_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  run_id TEXT NOT NULL REFERENCES review_momentum_runs(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  impact TEXT,
  effort TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_notification_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_qr_scans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  visitor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_qr_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cid TEXT,
  place_id TEXT,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE review_momentum_runs
  ADD COLUMN IF NOT EXISTS scan_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS lookback_days INT,
  ADD COLUMN IF NOT EXISTS competitor_limit INT;
