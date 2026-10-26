-- Align reputation schema with ported Reviews/LSE code expectations.

CREATE OR REPLACE VIEW businesses AS
SELECT
  w.id,
  w.id AS organization_id,
  COALESCE(w."displayName", w.name) AS name,
  NULL::text AS cid
FROM "Workspace" w;

CREATE TABLE IF NOT EXISTS business_keywords (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id TEXT NOT NULL,
  city TEXT,
  state TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_keywords_business
  ON business_keywords (business_id);

CREATE TABLE IF NOT EXISTS review_campaign_steps (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  campaign_id TEXT NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_campaign_steps_campaign
  ON review_campaign_steps (campaign_id, sort_order);

ALTER TABLE review_sync_state
  ADD COLUMN IF NOT EXISTS competitor_id TEXT,
  ADD COLUMN IF NOT EXISTS known_review_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_review_date_seen DATE;

CREATE UNIQUE INDEX IF NOT EXISTS review_sync_state_competitor_id_key
  ON review_sync_state (competitor_id)
  WHERE competitor_id IS NOT NULL;

ALTER TABLE review_request_messages
  ADD COLUMN IF NOT EXISTS step_key TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

ALTER TABLE review_request_contacts
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT,
  ADD COLUMN IF NOT EXISTS default_campaign_id TEXT;

ALTER TABLE review_request_recipients
  ADD COLUMN IF NOT EXISTS workflow_status TEXT,
  ADD COLUMN IF NOT EXISTS current_step_key TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;

ALTER TABLE review_request_sends
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS link_id TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS recipient_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_id TEXT;

ALTER TABLE review_momentum_entities
  ADD COLUMN IF NOT EXISTS total_reviews_current INT,
  ADD COLUMN IF NOT EXISTS rating_current NUMERIC,
  ADD COLUMN IF NOT EXISTS reviews_7d INT,
  ADD COLUMN IF NOT EXISTS reviews_30d INT,
  ADD COLUMN IF NOT EXISTS reviews_90d INT,
  ADD COLUMN IF NOT EXISTS reviews_yesterday INT,
  ADD COLUMN IF NOT EXISTS avg_reviews_per_week NUMERIC,
  ADD COLUMN IF NOT EXISTS days_since_last_review INT,
  ADD COLUMN IF NOT EXISTS acceleration_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS consistency_score NUMERIC,
  ADD COLUMN IF NOT EXISTS velocity_score NUMERIC,
  ADD COLUMN IF NOT EXISTS recency_score NUMERIC,
  ADD COLUMN IF NOT EXISTS momentum_score NUMERIC,
  ADD COLUMN IF NOT EXISTS momentum_label TEXT,
  ADD COLUMN IF NOT EXISTS gap_to_top3_30d INT,
  ADD COLUMN IF NOT EXISTS recommended_weekly_target INT;

ALTER TABLE review_momentum_tasks
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE review_qr_campaigns
  ADD COLUMN IF NOT EXISTS google_review_url TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
