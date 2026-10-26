-- S8 layout presets (run via prisma migrate deploy or manual on prod)
ALTER TABLE "stream_channels" ADD COLUMN IF NOT EXISTS "defaultPresetId" TEXT;

CREATE TABLE IF NOT EXISTS "stream_layout_presets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "layout" TEXT NOT NULL DEFAULT 'stack',
    "facecam" JSONB,
    "gameplay" JSONB,
    "split" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "facecamPosition" TEXT NOT NULL DEFAULT 'top',
    "source" TEXT NOT NULL DEFAULT 'auto',
    "confidence" DOUBLE PRECISION,
    "sampleFrameKey" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stream_layout_presets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "stream_layout_presets_workspaceId_channelId_idx"
  ON "stream_layout_presets"("workspaceId", "channelId");
