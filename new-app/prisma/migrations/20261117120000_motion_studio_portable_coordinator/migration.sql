
CREATE TABLE "MotionStudioPortableVersion" (
  "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "workspaceId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL, "parentId" TEXT, "sourceJobId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "manifest" JSONB NOT NULL, "theme" JSONB NOT NULL, "overrides" JSONB NOT NULL,
  "manifestHash" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "MotionStudioPortableVersion_projectId_revision_key"
  ON "MotionStudioPortableVersion"("projectId","revision");
CREATE INDEX "MotionStudioPortableVersion_workspaceId_projectId_createdAt_idx"
  ON "MotionStudioPortableVersion"("workspaceId","projectId","createdAt");

CREATE TABLE "MotionStudioRenderRequest" (
  "id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, "projectId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL, "sceneId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "patch" JSONB NOT NULL, "status" TEXT NOT NULL DEFAULT 'queued',
  "resultAssetId" TEXT, "workerId" TEXT, "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "MotionStudioRenderRequest_versionId_sceneId_idempotencyKey_key"
  ON "MotionStudioRenderRequest"("versionId","sceneId","idempotencyKey");
CREATE INDEX "MotionStudioRenderRequest_status_createdAt_idx"
  ON "MotionStudioRenderRequest"("status","createdAt");

CREATE TABLE "MotionStudioWorkerMachine" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "maxRenders" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE, "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "MotionStudioWorkerPlan" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "maxConcurrentAi" INTEGER NOT NULL DEFAULT 1,
  "weeklyLimitPercent" DOUBLE PRECISION NOT NULL DEFAULT 95,
  "observedPercent" DOUBLE PRECISION, "observedAt" TIMESTAMP(3),
  "resetsAt" TIMESTAMP(3), "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "MotionStudioProducerWorker" (
  "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "machineId" TEXT NOT NULL, "planId" TEXT NOT NULL,
  "webhookUrl" TEXT NOT NULL, "credentialHash" TEXT NOT NULL,
  "capabilities" JSONB NOT NULL, "maxConcurrent" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE, "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MotionStudioProducerWorker_machineId_idx" ON "MotionStudioProducerWorker"("machineId");
CREATE INDEX "MotionStudioProducerWorker_planId_idx" ON "MotionStudioProducerWorker"("planId");
CREATE TABLE "MotionStudioWorkerAssignment" (
  "id" TEXT PRIMARY KEY, "jobId" TEXT NOT NULL UNIQUE,
  "workspaceId" TEXT NOT NULL, "workerId" TEXT NOT NULL,
  "machineId" TEXT NOT NULL, "planId" TEXT NOT NULL,
  "leaseSecretHash" TEXT NOT NULL, "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "usageBefore" DOUBLE PRECISION, "usageAfter" DOUBLE PRECISION,
  "usageObservedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MotionStudioWorkerAssignment_status_leaseExpiresAt_idx" ON "MotionStudioWorkerAssignment"("status","leaseExpiresAt");
CREATE INDEX "MotionStudioWorkerAssignment_workerId_status_idx" ON "MotionStudioWorkerAssignment"("workerId","status");
CREATE INDEX "MotionStudioWorkerAssignment_machineId_status_idx" ON "MotionStudioWorkerAssignment"("machineId","status");
CREATE INDEX "MotionStudioWorkerAssignment_planId_status_idx" ON "MotionStudioWorkerAssignment"("planId","status");
