-- AlterTable
ALTER TABLE "clip_projects" ADD COLUMN IF NOT EXISTS "sourceKind" TEXT NOT NULL DEFAULT 'upload';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clip_projects_workspaceId_sourceKind_createdAt_idx" ON "clip_projects"("workspaceId", "sourceKind", "createdAt");

-- AlterEnum
ALTER TYPE "GenerationKind" ADD VALUE IF NOT EXISTS 'TTS_VOICE';
ALTER TYPE "GenerationKind" ADD VALUE IF NOT EXISTS 'AI_IMAGE';

-- CreateTable
CREATE TABLE "t2v_drafts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "stage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "assembledRevision" INTEGER,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t2v_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t2v_voice_clips" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
    "voiceId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "alignment" JSONB NOT NULL,
    "chars" INTEGER NOT NULL,
    "costUsdMicros" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t2v_voice_clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t2v_templates" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "aspect" TEXT NOT NULL DEFAULT '16:9',
    "previewKey" TEXT,
    "thumbKey" TEXT,
    "settings" JSONB NOT NULL,
    "sampleScript" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "t2v_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "t2v_saved_voices" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
    "voiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labels" JSONB,
    "previewUrl" TEXT,
    "isClone" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "consentById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "t2v_saved_voices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "t2v_drafts_projectId_key" ON "t2v_drafts"("projectId");

-- CreateIndex
CREATE INDEX "t2v_drafts_workspaceId_updatedAt_idx" ON "t2v_drafts"("workspaceId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "t2v_voice_clips_workspaceId_hash_key" ON "t2v_voice_clips"("workspaceId", "hash");

-- CreateIndex
CREATE INDEX "t2v_templates_workspaceId_category_sortOrder_idx" ON "t2v_templates"("workspaceId", "category", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "t2v_saved_voices_workspaceId_provider_voiceId_key" ON "t2v_saved_voices"("workspaceId", "provider", "voiceId");

-- AddForeignKey
ALTER TABLE "t2v_drafts" ADD CONSTRAINT "t2v_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
