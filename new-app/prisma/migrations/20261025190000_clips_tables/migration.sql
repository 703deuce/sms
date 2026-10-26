-- CreateEnum
CREATE TYPE "ClipProjectStatus" AS ENUM ('DRAFT', 'UPLOADING', 'QUEUED', 'PREPARING', 'TRANSCRIBING', 'SCANNING', 'FINDING_CLIPS', 'REFRAMING', 'RENDERING', 'READY', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ClipRenderStatus" AS ENUM ('QUEUED', 'RENDERING', 'READY', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "clip_uploads" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "mime" TEXT NOT NULL,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "s3UploadId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'source',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clip_projects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL DEFAULT 'dev',
    "title" TEXT NOT NULL,
    "uploadId" TEXT,
    "sourceUrl" TEXT,
    "settings" JSONB NOT NULL,
    "rangeStartMs" INTEGER NOT NULL DEFAULT 0,
    "rangeEndMs" INTEGER NOT NULL DEFAULT 0,
    "status" "ClipProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "stage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "creditsReserved" INTEGER NOT NULL DEFAULT 0,
    "creditsCaptured" INTEGER NOT NULL DEFAULT 0,
    "transcriptKey" TEXT,
    "transcriptWords" JSONB,
    "proxyKey" TEXT,
    "thumbKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clip_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "clipId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "clip_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clips" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "cropKey" TEXT,
    "wordsKey" TEXT,
    "previewKey" TEXT,
    "posterKey" TEXT,
    "edits" JSONB NOT NULL DEFAULT '{}',
    "aiMeta" JSONB,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clip_brand_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "logoKey" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_brand_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clip_uploads_workspaceId_createdAt_idx" ON "clip_uploads"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "clip_projects_workspaceId_createdAt_idx" ON "clip_projects"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "clip_jobs_status_priority_runAfter_idx" ON "clip_jobs"("status", "priority", "runAfter");

-- CreateIndex
CREATE INDEX "clips_projectId_idx" ON "clips"("projectId");

-- CreateIndex
CREATE INDEX "clip_brand_templates_workspaceId_idx" ON "clip_brand_templates"("workspaceId");

-- AddForeignKey
ALTER TABLE "clip_uploads" ADD CONSTRAINT "clip_uploads_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_projects" ADD CONSTRAINT "clip_projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_projects" ADD CONSTRAINT "clip_projects_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "clip_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_jobs" ADD CONSTRAINT "clip_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_brand_templates" ADD CONSTRAINT "clip_brand_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
