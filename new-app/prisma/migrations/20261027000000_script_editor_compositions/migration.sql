-- Script editor compositions (additive)
CREATE TYPE "ScriptCompositionKind" AS ENUM ('FULL', 'CLIP');

CREATE TABLE "script_media_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "fps" DOUBLE PRECISION,
    "sourceKey" TEXT NOT NULL,
    "proxyHlsKey" TEXT,
    "audioPeaksKey" TEXT,
    "thumbsSpriteKey" TEXT,
    "enrichedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_speakers" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_speakers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_compositions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "ScriptCompositionKind" NOT NULL,
    "clipId" TEXT,
    "title" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "aspect" TEXT NOT NULL DEFAULT '9:16',
    "captionStyleId" TEXT,
    "captionPos" JSONB,
    "reframe" JSONB NOT NULL DEFAULT '{}',
    "document" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_compositions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_ops" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "baseRevision" INTEGER NOT NULL,
    "op" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "script_composition_ops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_snapshots" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "document" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_composition_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_versions" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "name" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "document" JSONB NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "script_composition_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_leases" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_composition_leases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_renders" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "outputKey" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_composition_renders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "script_media_assets_projectId_key" ON "script_media_assets"("projectId");
CREATE INDEX "script_media_assets_workspaceId_idx" ON "script_media_assets"("workspaceId");
CREATE UNIQUE INDEX "script_speakers_projectId_label_key" ON "script_speakers"("projectId", "label");
CREATE INDEX "script_speakers_projectId_idx" ON "script_speakers"("projectId");
CREATE UNIQUE INDEX "script_compositions_projectId_kind_clipId_key" ON "script_compositions"("projectId", "kind", "clipId");
CREATE INDEX "script_compositions_workspaceId_updatedAt_idx" ON "script_compositions"("workspaceId", "updatedAt");
CREATE UNIQUE INDEX "script_composition_ops_compositionId_id_key" ON "script_composition_ops"("compositionId", "id");
CREATE INDEX "script_composition_ops_compositionId_revision_idx" ON "script_composition_ops"("compositionId", "revision");
CREATE UNIQUE INDEX "script_composition_snapshots_compositionId_revision_key" ON "script_composition_snapshots"("compositionId", "revision");
CREATE INDEX "script_composition_versions_compositionId_createdAt_idx" ON "script_composition_versions"("compositionId", "createdAt");
CREATE UNIQUE INDEX "script_composition_leases_compositionId_key" ON "script_composition_leases"("compositionId");
CREATE UNIQUE INDEX "script_composition_renders_compositionId_idempotencyKey_key" ON "script_composition_renders"("compositionId", "idempotencyKey");
CREATE INDEX "script_composition_renders_workspaceId_status_idx" ON "script_composition_renders"("workspaceId", "status");

ALTER TABLE "script_media_assets" ADD CONSTRAINT "script_media_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_speakers" ADD CONSTRAINT "script_speakers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_compositions" ADD CONSTRAINT "script_compositions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_compositions" ADD CONSTRAINT "script_compositions_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_ops" ADD CONSTRAINT "script_composition_ops_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_snapshots" ADD CONSTRAINT "script_composition_snapshots_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_versions" ADD CONSTRAINT "script_composition_versions_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_leases" ADD CONSTRAINT "script_composition_leases_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_renders" ADD CONSTRAINT "script_composition_renders_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
