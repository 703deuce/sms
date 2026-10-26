-- Columns expected by Reviews contacts list/import (ported LSE code).

ALTER TABLE review_request_contacts
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_completion JSONB,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS customer_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_review_contacts_workspace_updated
  ON review_request_contacts (business_id, updated_at DESC);
