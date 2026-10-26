-- Align review_request_events with runtime insert shape (email sends + audit).

ALTER TABLE review_request_events
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
