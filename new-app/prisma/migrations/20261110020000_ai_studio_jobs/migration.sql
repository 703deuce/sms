-- AI Studio v1 jobs and reference assets. Additive only; no billing columns.
CREATE TABLE "ai_studio_assets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_studio_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_studio_assets_workspaceId_createdAt_idx" ON "ai_studio_assets"("workspaceId", "createdAt");

ALTER TABLE "ai_studio_assets" ADD CONSTRAINT "ai_studio_assets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_studio_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "aspect" TEXT,
    "durationSec" INTEGER,
    "resolution" TEXT,
    "creditEstimate" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'kie',
    "providerTaskId" TEXT,
    "providerApi" TEXT,
    "referenceAssetId" TEXT,
    "startFrameAssetId" TEXT,
    "endFrameAssetId" TEXT,
    "outputStorageKey" TEXT,
    "outputStorageDriver" TEXT,
    "outputContentType" TEXT,
    "outputWidth" INTEGER,
    "outputHeight" INTEGER,
    "outputDurationSec" INTEGER,
    "outputKind" TEXT,
    "outputUploadId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ai_studio_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_studio_jobs_workspaceId_createdAt_idx" ON "ai_studio_jobs"("workspaceId", "createdAt");
CREATE INDEX "ai_studio_jobs_workspaceId_userId_status_idx" ON "ai_studio_jobs"("workspaceId", "userId", "status");
CREATE INDEX "ai_studio_jobs_providerTaskId_idx" ON "ai_studio_jobs"("providerTaskId");

ALTER TABLE "ai_studio_jobs" ADD CONSTRAINT "ai_studio_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
