CREATE TABLE "AdStudioImageVariant" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "headline" TEXT NOT NULL,
  "cta" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "studioJobId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdStudioImageVariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdStudioImageVariant_runId_index_key" ON "AdStudioImageVariant"("runId","index");
ALTER TABLE "AdStudioImageVariant" ADD CONSTRAINT "AdStudioImageVariant_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "AdStudioRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
