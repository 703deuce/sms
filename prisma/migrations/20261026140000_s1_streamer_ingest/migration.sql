-- CreateTable
CREATE TABLE "stream_channels" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "externalId" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "connectionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PASTE_ONLY',
    "autoProcess" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "platformState" JSONB NOT NULL DEFAULT '{}',
    "lastVodAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stream_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stream_vods" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "channelId" TEXT,
    "platform" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "title" TEXT,
    "category" TEXT,
    "chapters" JSONB,
    "streamedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "rangeStartMs" INTEGER NOT NULL DEFAULT 0,
    "rangeEndMs" INTEGER,
    "triggeredBy" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL DEFAULT '{}',
    "signalsKey" TEXT,
    "chatSource" TEXT,
    "chatMessages" INTEGER,
    "sourceDeletedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stream_vods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stream_channels_workspaceId_platform_login_key" ON "stream_channels"("workspaceId", "platform", "login");

-- CreateIndex
CREATE INDEX "stream_channels_platform_externalId_idx" ON "stream_channels"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "stream_vods_projectId_key" ON "stream_vods"("projectId");

-- CreateIndex
CREATE INDEX "stream_vods_workspaceId_createdAt_idx" ON "stream_vods"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "stream_vods_channelId_streamedAt_idx" ON "stream_vods"("channelId", "streamedAt");

-- AddForeignKey
ALTER TABLE "stream_channels" ADD CONSTRAINT "stream_channels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_vods" ADD CONSTRAINT "stream_vods_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_vods" ADD CONSTRAINT "stream_vods_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stream_vods" ADD CONSTRAINT "stream_vods_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "stream_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
