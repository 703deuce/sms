-- Drive folders + project last viewed
CREATE TABLE "clip_project_folders" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_project_folders_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "clip_projects" ADD COLUMN "folderId" TEXT;
ALTER TABLE "clip_projects" ADD COLUMN "lastViewedAt" TIMESTAMP(3);

CREATE INDEX "clip_projects_workspaceId_folderId_idx" ON "clip_projects"("workspaceId", "folderId");

ALTER TABLE "clip_project_folders" ADD CONSTRAINT "clip_project_folders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clip_project_folders" ADD CONSTRAINT "clip_project_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "clip_project_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clip_projects" ADD CONSTRAINT "clip_projects_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "clip_project_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "clip_project_folders_workspaceId_parentId_idx" ON "clip_project_folders"("workspaceId", "parentId");

-- Comments, share, publish, prefs
CREATE TYPE "ScriptShareRole" AS ENUM ('VIEW', 'COMMENT', 'EDIT');
CREATE TYPE "ScriptLinkAccess" AS ENUM ('INVITE_ONLY', 'LINK_VIEW', 'LINK_COMMENT');

CREATE TABLE "script_composition_comment_threads" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "startOutMs" INTEGER NOT NULL DEFAULT 0,
    "endOutMs" INTEGER NOT NULL DEFAULT 0,
    "anchorWordStart" TEXT,
    "anchorWordEnd" TEXT,
    "quoteText" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "script_composition_comment_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_comments" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentionedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_composition_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_share_links" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "ScriptShareRole" NOT NULL DEFAULT 'VIEW',
    "linkAccess" "ScriptLinkAccess" NOT NULL DEFAULT 'INVITE_ONLY',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "script_composition_share_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_publish" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "publicSlug" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "outputKey" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_composition_publish_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_composition_collaborators" (
    "id" TEXT NOT NULL,
    "compositionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ScriptShareRole" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_composition_collaborators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "script_editor_user_prefs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prefs" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_editor_user_prefs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "script_composition_share_links_tokenHash_key" ON "script_composition_share_links"("tokenHash");
CREATE INDEX "script_composition_share_links_compositionId_idx" ON "script_composition_share_links"("compositionId");
CREATE INDEX "script_composition_comment_threads_compositionId_createdAt_idx" ON "script_composition_comment_threads"("compositionId", "createdAt");
CREATE INDEX "script_composition_comments_threadId_createdAt_idx" ON "script_composition_comments"("threadId", "createdAt");
CREATE UNIQUE INDEX "script_composition_publish_compositionId_key" ON "script_composition_publish"("compositionId");
CREATE UNIQUE INDEX "script_composition_publish_publicSlug_key" ON "script_composition_publish"("publicSlug");
CREATE INDEX "script_composition_publish_workspaceId_idx" ON "script_composition_publish"("workspaceId");
CREATE UNIQUE INDEX "script_composition_collaborators_compositionId_userId_key" ON "script_composition_collaborators"("compositionId", "userId");
CREATE UNIQUE INDEX "script_editor_user_prefs_workspaceId_userId_key" ON "script_editor_user_prefs"("workspaceId", "userId");

ALTER TABLE "script_composition_comment_threads" ADD CONSTRAINT "script_composition_comment_threads_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_comments" ADD CONSTRAINT "script_composition_comments_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "script_composition_comment_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_comments" ADD CONSTRAINT "script_composition_comments_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "script_composition_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "script_composition_share_links" ADD CONSTRAINT "script_composition_share_links_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_publish" ADD CONSTRAINT "script_composition_publish_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "script_composition_collaborators" ADD CONSTRAINT "script_composition_collaborators_compositionId_fkey" FOREIGN KEY ("compositionId") REFERENCES "script_compositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
