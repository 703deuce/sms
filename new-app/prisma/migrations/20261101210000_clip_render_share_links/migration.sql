-- ClipRender export share links (EX-20)

CREATE TABLE "clip_render_share_links" (
    "id" TEXT NOT NULL,
    "renderId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_render_share_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clip_render_share_links_slug_key" ON "clip_render_share_links"("slug");

CREATE INDEX "clip_render_share_links_renderId_idx" ON "clip_render_share_links"("renderId");

CREATE INDEX "clip_render_share_links_workspaceId_createdAt_idx" ON "clip_render_share_links"("workspaceId", "createdAt");

ALTER TABLE "clip_render_share_links" ADD CONSTRAINT "clip_render_share_links_renderId_fkey" FOREIGN KEY ("renderId") REFERENCES "clip_renders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clip_render_share_links" ADD CONSTRAINT "clip_render_share_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
