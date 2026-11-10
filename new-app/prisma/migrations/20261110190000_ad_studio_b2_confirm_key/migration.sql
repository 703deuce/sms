-- B2: persist the confirmation idempotency key independently of the creation key.
-- Nullable for existing B1 rows; no table or column is removed.
ALTER TABLE "AdStudioRun" ADD COLUMN IF NOT EXISTS "confirmIdempotencyKey" TEXT;
