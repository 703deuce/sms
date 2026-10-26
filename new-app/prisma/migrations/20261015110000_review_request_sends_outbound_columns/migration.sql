-- Align review_request_sends with runtime insert shape (one-off + campaign sends).

ALTER TABLE review_request_sends
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS review_url TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
