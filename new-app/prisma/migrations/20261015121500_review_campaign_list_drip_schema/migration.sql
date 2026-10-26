-- List upload + drip campaign runtime (ported Reviews campaigns.ts).

ALTER TABLE review_request_campaigns
  ADD COLUMN IF NOT EXISTS email_template_id TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT 'request_review',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sequence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_strategy TEXT,
  ADD COLUMN IF NOT EXISTS terms_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS success_mode TEXT DEFAULT 'click',
  ADD COLUMN IF NOT EXISTS source_template_id TEXT,
  ADD COLUMN IF NOT EXISTS source_template_version TEXT,
  ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS webhook_endpoint_id TEXT,
  ADD COLUMN IF NOT EXISTS enrollments_paused BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS review_request_uploads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  campaign_id TEXT REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  filename TEXT,
  total_rows INT,
  valid_rows INT,
  skipped_rows INT,
  mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_request_uploads_campaign
  ON review_request_uploads (campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_campaign_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  upload_id TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  recipient_count INT,
  eligible_count INT,
  skipped_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_campaign_runs_campaign
  ON review_campaign_runs (campaign_id, created_at DESC);

ALTER TABLE review_request_recipients
  ADD COLUMN IF NOT EXISTS upload_id TEXT,
  ADD COLUMN IF NOT EXISTS service_date DATE,
  ADD COLUMN IF NOT EXISTS job_type TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS current_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrollment_source TEXT,
  ADD COLUMN IF NOT EXISTS campaign_run_id TEXT,
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
