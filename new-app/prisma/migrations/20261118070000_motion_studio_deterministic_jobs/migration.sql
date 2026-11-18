-- Whole-film deterministic rendering is separate from individual scene previews
-- and AI creative production. Additive: no existing records are rewritten.
CREATE TABLE "MotionStudioDeterministicJob" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "jobInput" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "workerId" TEXT,
  "leaseHash" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "upload" JSONB,
  "resultAssetId" TEXT,
  "publishedVersionId" TEXT,
  "durationMs" INTEGER,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MotionStudioDeterministicJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MotionStudioDeterministicJob_versionId_idempotencyKey_key"
  ON "MotionStudioDeterministicJob" ("versionId", "idempotencyKey");
CREATE INDEX "MotionStudioDeterministicJob_status_createdAt_idx"
  ON "MotionStudioDeterministicJob" ("status", "createdAt");
CREATE INDEX "MotionStudioDeterministicJob_workspaceId_projectId_createdAt_idx"
  ON "MotionStudioDeterministicJob" ("workspaceId", "projectId", "createdAt");
