-- QR campaign columns required by reputation QR service (ported from Supabase schema).
ALTER TABLE review_qr_campaigns
  ADD COLUMN IF NOT EXISTS short_code TEXT,
  ADD COLUMN IF NOT EXISTS destination_url TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_placement_label TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS print_format TEXT,
  ADD COLUMN IF NOT EXISTS show_footer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS poster_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'review';

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_campaigns_short_code_key
  ON review_qr_campaigns (short_code)
  WHERE short_code IS NOT NULL;

ALTER TABLE review_qr_scans
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS device_category TEXT,
  ADD COLUMN IF NOT EXISTS browser_category TEXT,
  ADD COLUMN IF NOT EXISTS os_category TEXT,
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_preview BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS counted BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE review_qr_campaigns
  ADD COLUMN IF NOT EXISTS total_scans INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_unique_scans INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;
