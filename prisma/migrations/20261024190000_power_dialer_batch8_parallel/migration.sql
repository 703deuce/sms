ALTER TABLE "power_dialer_attempts" ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;
ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "parallelStateJson" JSONB;
ALTER TABLE "power_dialer_sessions" ADD COLUMN IF NOT EXISTS "transferStateJson" JSONB;
