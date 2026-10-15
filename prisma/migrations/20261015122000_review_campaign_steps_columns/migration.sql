-- Align review_campaign_steps with sequence-runner persist shape.

ALTER TABLE review_campaign_steps
  ADD COLUMN IF NOT EXISTS organization_id TEXT,
  ADD COLUMN IF NOT EXISTS business_id TEXT,
  ADD COLUMN IF NOT EXISTS step_index INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS config_json JSONB NOT NULL DEFAULT '{}'::jsonb;
