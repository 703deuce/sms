-- Ad Studio B1: additive schema only; preserve existing studio and clip tables.
CREATE TABLE "AdStudioRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "plan" JSONB,
  "creditEstimate" INTEGER,
  "creditCharged" INTEGER,
  "projectId" TEXT,
  "clipId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AdStudioRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AdStudioScene" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "durationSec" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "providerId" TEXT,
  "stockAssetId" TEXT,
  "sourceInMs" INTEGER,
  "sourceOutMs" INTEGER,
  "stockQuery" TEXT,
  "studioJobId" TEXT,
  "modelId" TEXT,
  "prompt" TEXT,
  "startMs" INTEGER NOT NULL,
  "endMs" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  CONSTRAINT "AdStudioScene_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdStudioRun_workspaceId_idempotencyKey_key" ON "AdStudioRun"("workspaceId","idempotencyKey");
CREATE INDEX "AdStudioRun_workspaceId_createdAt_idx" ON "AdStudioRun"("workspaceId","createdAt");
CREATE UNIQUE INDEX "AdStudioScene_runId_index_key" ON "AdStudioScene"("runId","index");
ALTER TABLE "AdStudioScene" ADD CONSTRAINT "AdStudioScene_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AdStudioRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
