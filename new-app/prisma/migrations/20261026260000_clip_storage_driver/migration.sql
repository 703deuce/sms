-- Per-object storage backend (supabase | r2 | s3) for mixed buckets during migration.
ALTER TABLE "clip_uploads" ADD COLUMN IF NOT EXISTS "storageDriver" TEXT;
ALTER TABLE "clips" ADD COLUMN IF NOT EXISTS "storageDriver" TEXT;
