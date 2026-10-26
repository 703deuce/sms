-- Screenwriting W1 (Sw* tables)

CREATE TYPE "SwProjectKind" AS ENUM ('FEATURE', 'TV_SERIES', 'STAGE', 'OTHER');
CREATE TYPE "SwPhase" AS ENUM ('WRITING', 'PRODUCTION');
CREATE TYPE "SwVersionKind" AS ENUM ('AUTO', 'MANUAL', 'IMPORT', 'PRODUCTION_DRAFT', 'PRE_RESTORE', 'LOCK');
CREATE TYPE "SwRole" AS ENUM ('OWNER', 'EDITOR', 'COMMENTER', 'VIEWER');

CREATE TABLE "sw_projects" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "SwProjectKind" NOT NULL DEFAULT 'FEATURE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sw_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_scripts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "episodeNo" TEXT,
    "templateKey" TEXT NOT NULL DEFAULT 'feature',
    "formatSpec" JSONB NOT NULL,
    "yState" BYTEA,
    "pmJson" JSONB,
    "phase" "SwPhase" NOT NULL DEFAULT 'WRITING',
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "sceneCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "searchText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sw_scripts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_versions" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "kind" "SwVersionKind" NOT NULL,
    "label" TEXT,
    "yState" BYTEA NOT NULL,
    "pmJson" JSONB NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sw_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_scenes" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "number" TEXT,
    "heading" TEXT NOT NULL,
    "intExt" TEXT,
    "location" TEXT,
    "tod" TEXT,
    "pageStart" TEXT,
    "eighths" INTEGER,
    "synopsis" TEXT,
    "characters" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "sw_scenes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_characters" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gender" TEXT,
    "color" TEXT,
    "voiceId" TEXT,
    "description" TEXT,
    "lines" INTEGER NOT NULL DEFAULT 0,
    "words" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sw_characters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_locations" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sceneCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sw_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_breakdown_categories" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,

    CONSTRAINT "sw_breakdown_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_breakdown_items" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "sw_breakdown_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_comment_threads" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "anchorFrom" TEXT NOT NULL,
    "anchorTo" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sw_comment_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_comments" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sw_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_members" (
    "scriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SwRole" NOT NULL,

    CONSTRAINT "sw_members_pkey" PRIMARY KEY ("scriptId","userId")
);

CREATE TABLE "sw_share_links" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "SwRole" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "watermark" BOOLEAN NOT NULL DEFAULT false,
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sw_share_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_dictionary_words" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "word" TEXT NOT NULL,

    CONSTRAINT "sw_dictionary_words_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_templates" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sw_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_jobs" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "creditCost" INTEGER,
    "creditsCharged" INTEGER,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sw_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_ai_results" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "versionId" TEXT,
    "scope" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sw_ai_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sw_table_reads" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "castMap" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "segments" JSONB,
    "audioUrl" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sw_table_reads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sw_scripts_projectId_idx" ON "sw_scripts"("projectId");
CREATE INDEX "sw_versions_scriptId_createdAt_idx" ON "sw_versions"("scriptId", "createdAt");
CREATE INDEX "sw_scenes_scriptId_ord_idx" ON "sw_scenes"("scriptId", "ord");
CREATE UNIQUE INDEX "sw_characters_scriptId_name_key" ON "sw_characters"("scriptId", "name");
CREATE UNIQUE INDEX "sw_locations_scriptId_name_key" ON "sw_locations"("scriptId", "name");
CREATE INDEX "sw_breakdown_items_scriptId_idx" ON "sw_breakdown_items"("scriptId");
CREATE UNIQUE INDEX "sw_share_links_tokenHash_key" ON "sw_share_links"("tokenHash");
CREATE UNIQUE INDEX "sw_dictionary_words_scope_word_key" ON "sw_dictionary_words"("scope", "word");
CREATE INDEX "sw_jobs_status_type_idx" ON "sw_jobs"("status", "type");
CREATE INDEX "sw_ai_results_scriptId_kind_idx" ON "sw_ai_results"("scriptId", "kind");

ALTER TABLE "sw_scripts" ADD CONSTRAINT "sw_scripts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "sw_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_versions" ADD CONSTRAINT "sw_versions_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_scenes" ADD CONSTRAINT "sw_scenes_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_characters" ADD CONSTRAINT "sw_characters_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_locations" ADD CONSTRAINT "sw_locations_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_breakdown_items" ADD CONSTRAINT "sw_breakdown_items_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_comment_threads" ADD CONSTRAINT "sw_comment_threads_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_comments" ADD CONSTRAINT "sw_comments_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "sw_comment_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_members" ADD CONSTRAINT "sw_members_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_share_links" ADD CONSTRAINT "sw_share_links_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sw_jobs" ADD CONSTRAINT "sw_jobs_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "sw_scripts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
