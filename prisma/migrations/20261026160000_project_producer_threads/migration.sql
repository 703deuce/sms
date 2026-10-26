ALTER TABLE "producer_threads" ALTER COLUMN "clipId" DROP NOT NULL;

ALTER TABLE "producer_threads" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "producer_threads_projectId_key"
  ON "producer_threads"("projectId")
  WHERE "projectId" IS NOT NULL;
