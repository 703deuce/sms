-- Direct-to-storage upload part bookkeeping (restores 64d759c87 schema; safe on prod with IF NOT EXISTS).

ALTER TABLE "clip_uploads" ADD COLUMN IF NOT EXISTS "uploadMode" TEXT;

CREATE TABLE IF NOT EXISTS "clip_upload_parts" (
    "uploadId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "etag" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_upload_parts_pkey" PRIMARY KEY ("uploadId", "partNumber")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clip_upload_parts_uploadId_fkey'
    ) THEN
        ALTER TABLE "clip_upload_parts"
            ADD CONSTRAINT "clip_upload_parts_uploadId_fkey"
            FOREIGN KEY ("uploadId") REFERENCES "clip_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
