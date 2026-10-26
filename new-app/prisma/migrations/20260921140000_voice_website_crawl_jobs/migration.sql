-- Voice V3 website crawl jobs (100-page useful cap enforced in application code).

CREATE TABLE IF NOT EXISTS "voice_website_crawl_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "rootUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCOVERING',
    "stats" JSONB,
    "errorSummary" TEXT,
    "suggestions" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voice_website_crawl_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "voice_website_crawl_pages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "knowledgeSourceId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "pageTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contentHash" TEXT,
    "skipReason" TEXT,
    "errorMessage" TEXT,
    "lastIndexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voice_website_crawl_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_website_crawl_pages_crawlJobId_sourceUrl_key"
  ON "voice_website_crawl_pages"("crawlJobId", "sourceUrl");
CREATE INDEX IF NOT EXISTS "voice_website_crawl_jobs_workspaceId_knowledgeBaseId_idx"
  ON "voice_website_crawl_jobs"("workspaceId", "knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "voice_website_crawl_jobs_workspaceId_status_idx"
  ON "voice_website_crawl_jobs"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_website_crawl_pages_workspaceId_crawlJobId_idx"
  ON "voice_website_crawl_pages"("workspaceId", "crawlJobId");

DO $$ BEGIN
  ALTER TABLE "voice_website_crawl_jobs" ADD CONSTRAINT "voice_website_crawl_jobs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "voice_website_crawl_jobs" ADD CONSTRAINT "voice_website_crawl_jobs_knowledgeBaseId_fkey"
    FOREIGN KEY ("knowledgeBaseId") REFERENCES "voice_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "voice_website_crawl_pages" ADD CONSTRAINT "voice_website_crawl_pages_crawlJobId_fkey"
    FOREIGN KEY ("crawlJobId") REFERENCES "voice_website_crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "voice_website_crawl_pages" ADD CONSTRAINT "voice_website_crawl_pages_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
