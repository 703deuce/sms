DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'producer_threads' AND column_name = 'clipId' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "producer_threads" ALTER COLUMN "clipId" DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE "producer_threads" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "producer_threads_projectId_key"
  ON "producer_threads"("projectId")
  WHERE "projectId" IS NOT NULL;
