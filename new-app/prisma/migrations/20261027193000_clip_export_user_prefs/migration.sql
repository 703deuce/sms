-- Additive: per-user export defaults and saved streamer channel links
CREATE TABLE IF NOT EXISTS "clip_export_user_prefs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_export_user_prefs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "clip_export_user_prefs_workspaceId_userId_key"
ON "clip_export_user_prefs"("workspaceId", "userId");

CREATE TABLE IF NOT EXISTS "clip_user_streamer_channels" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_user_streamer_channels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clip_user_streamer_channels_workspaceId_userId_idx"
ON "clip_user_streamer_channels"("workspaceId", "userId");
