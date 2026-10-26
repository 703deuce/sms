-- Transovo AI Remodel Visualizer (launch)

CREATE TYPE "VisualizerProjectStatus" AS ENUM (
  'DRAFT',
  'DESIGN_READY',
  'SHARED',
  'INTERESTED',
  'ESTIMATE_REQUESTED',
  'APPOINTMENT_SCHEDULED',
  'WON',
  'LOST',
  'ARCHIVED'
);

CREATE TYPE "VisualizerTransformationType" AS ENUM (
  'TUB_TO_SHOWER',
  'SHOWER_REPLACEMENT',
  'WALL_PANEL_UPGRADE',
  'BATHROOM_REFRESH',
  'CUSTOM'
);

CREATE TYPE "VisualizerAssetType" AS ENUM (
  'ORIGINAL_ROOM',
  'SECONDARY_ROOM_REFERENCE',
  'MATERIAL_REFERENCE',
  'GENERATED_DESIGN',
  'THUMBNAIL'
);

CREATE TYPE "VisualizerGenerationJobStatus" AS ENUM (
  'QUEUED',
  'UPLOADING',
  'PREPARING',
  'GENERATING',
  'SAVING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE "VisualizerProjectSource" AS ENUM (
  'SALES_REP',
  'EXISTING_CONTACT',
  'WEBSITE_WIDGET',
  'HOSTED_PAGE',
  'INTERNAL'
);

CREATE TABLE "visualizer_material" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "manufacturer" TEXT,
  "sku" TEXT,
  "finish" TEXT,
  "description" TEXT,
  "imageStoragePath" TEXT NOT NULL,
  "imageMimeType" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "publicVisible" BOOLEAN NOT NULL DEFAULT false,
  "internalNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visualizer_material_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_project" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT,
  "name" TEXT NOT NULL,
  "transformation" "VisualizerTransformationType" NOT NULL DEFAULT 'TUB_TO_SHOWER',
  "status" "VisualizerProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "source" "VisualizerProjectSource" NOT NULL DEFAULT 'INTERNAL',
  "notes" TEXT,
  "assignedUserId" TEXT,
  "primaryRoomAssetId" TEXT,
  "wizardDraftJson" JSONB,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visualizer_project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_asset" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT,
  "assetType" "VisualizerAssetType" NOT NULL,
  "storagePath" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "byteSize" INTEGER NOT NULL,
  "originalFilename" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visualizer_asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_design" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "parentDesignId" TEXT,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "generatedAssetId" TEXT,
  "originalRoomAssetId" TEXT NOT NULL,
  "transformation" "VisualizerTransformationType" NOT NULL,
  "selectedMaterialsJson" JSONB NOT NULL DEFAULT '[]',
  "instructions" TEXT,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "generationJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visualizer_design_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_generation_job" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "designId" TEXT,
  "status" "VisualizerGenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "model" TEXT,
  "requestJson" JSONB NOT NULL,
  "errorMessage" TEXT,
  "usageCredits" INTEGER NOT NULL DEFAULT 1,
  "providerCostCents" INTEGER,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visualizer_generation_job_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_share" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "designId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "allowEstimateRequest" BOOLEAN NOT NULL DEFAULT true,
  "showMaterials" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visualizer_share_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_estimate_request" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "designId" TEXT,
  "contactId" TEXT,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "serviceZip" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "source" TEXT NOT NULL DEFAULT 'share',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visualizer_estimate_request_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_event" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT,
  "eventType" TEXT NOT NULL,
  "actorType" TEXT,
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visualizer_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_widget_config" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "publicSlug" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "brandingJson" JSONB NOT NULL DEFAULT '{}',
  "limitsJson" JSONB NOT NULL DEFAULT '{}',
  "leadCaptureJson" JSONB NOT NULL DEFAULT '{}',
  "enabledTransformations" TEXT[] DEFAULT ARRAY['TUB_TO_SHOWER', 'SHOWER_REPLACEMENT']::TEXT[],
  "publicMaterialIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "allowedEmbedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "visualizer_widget_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visualizer_usage_ledger" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "generationJobId" TEXT,
  "credits" INTEGER NOT NULL DEFAULT 1,
  "kind" TEXT NOT NULL DEFAULT 'generation',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visualizer_usage_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "visualizer_generation_job_idempotencyKey_key" ON "visualizer_generation_job"("idempotencyKey");
CREATE UNIQUE INDEX "visualizer_share_tokenHash_key" ON "visualizer_share"("tokenHash");
CREATE UNIQUE INDEX "visualizer_widget_config_workspaceId_key" ON "visualizer_widget_config"("workspaceId");
CREATE UNIQUE INDEX "visualizer_widget_config_publicSlug_key" ON "visualizer_widget_config"("publicSlug");
CREATE UNIQUE INDEX "visualizer_widget_config_publicKey_key" ON "visualizer_widget_config"("publicKey");

CREATE INDEX "visualizer_project_workspaceId_updatedAt_idx" ON "visualizer_project"("workspaceId", "updatedAt" DESC);
CREATE INDEX "visualizer_material_workspaceId_category_idx" ON "visualizer_material"("workspaceId", "category");
CREATE INDEX "visualizer_design_projectId_idx" ON "visualizer_design"("projectId");
CREATE INDEX "visualizer_generation_job_projectId_idx" ON "visualizer_generation_job"("projectId");

ALTER TABLE "visualizer_material" ADD CONSTRAINT "visualizer_material_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_project" ADD CONSTRAINT "visualizer_project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_project" ADD CONSTRAINT "visualizer_project_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "visualizer_asset" ADD CONSTRAINT "visualizer_asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_asset" ADD CONSTRAINT "visualizer_asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "visualizer_project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "visualizer_design" ADD CONSTRAINT "visualizer_design_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_design" ADD CONSTRAINT "visualizer_design_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "visualizer_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_generation_job" ADD CONSTRAINT "visualizer_generation_job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_generation_job" ADD CONSTRAINT "visualizer_generation_job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "visualizer_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_share" ADD CONSTRAINT "visualizer_share_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_share" ADD CONSTRAINT "visualizer_share_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "visualizer_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_estimate_request" ADD CONSTRAINT "visualizer_estimate_request_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_event" ADD CONSTRAINT "visualizer_event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_widget_config" ADD CONSTRAINT "visualizer_widget_config_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizer_usage_ledger" ADD CONSTRAINT "visualizer_usage_ledger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
