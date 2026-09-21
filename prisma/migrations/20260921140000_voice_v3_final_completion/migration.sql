-- Voice V3 final completion: website crawl jobs + per-call billing ledger.

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

CREATE TABLE IF NOT EXISTS "voice_v3_usage_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'voice_v3',
    "metric" TEXT NOT NULL DEFAULT 'billable_call',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingStatus" TEXT NOT NULL DEFAULT 'pending',
    "externalEventId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voice_v3_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "voice_website_crawl_pages_crawlJobId_sourceUrl_key"
  ON "voice_website_crawl_pages"("crawlJobId", "sourceUrl");
CREATE INDEX IF NOT EXISTS "voice_website_crawl_jobs_workspaceId_knowledgeBaseId_idx"
  ON "voice_website_crawl_jobs"("workspaceId", "knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "voice_website_crawl_jobs_workspaceId_status_idx"
  ON "voice_website_crawl_jobs"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "voice_website_crawl_pages_workspaceId_crawlJobId_idx"
  ON "voice_website_crawl_pages"("workspaceId", "crawlJobId");
CREATE UNIQUE INDEX IF NOT EXISTS "voice_v3_usage_events_product_metric_voiceCallId_key"
  ON "voice_v3_usage_events"("product", "metric", "voiceCallId");
CREATE INDEX IF NOT EXISTS "voice_v3_usage_events_workspaceId_billingStatus_idx"
  ON "voice_v3_usage_events"("workspaceId", "billingStatus");
CREATE INDEX IF NOT EXISTS "voice_v3_usage_events_voiceCallId_idx"
  ON "voice_v3_usage_events"("voiceCallId");

ALTER TABLE "voice_website_crawl_jobs" ADD CONSTRAINT "voice_website_crawl_jobs_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_website_crawl_jobs" ADD CONSTRAINT "voice_website_crawl_jobs_knowledgeBaseId_fkey"
  FOREIGN KEY ("knowledgeBaseId") REFERENCES "voice_knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_website_crawl_pages" ADD CONSTRAINT "voice_website_crawl_pages_crawlJobId_fkey"
  FOREIGN KEY ("crawlJobId") REFERENCES "voice_website_crawl_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_website_crawl_pages" ADD CONSTRAINT "voice_website_crawl_pages_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_v3_usage_events" ADD CONSTRAINT "voice_v3_usage_events_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
