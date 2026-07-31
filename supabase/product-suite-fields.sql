-- Product suite: link clicks, media, surveys, grow widgets, contact cards
CREATE TABLE IF NOT EXISTS "link_click_events" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "trackingToken" TEXT NOT NULL,
  "contactId" TEXT,
  "phone" TEXT,
  "campaignId" TEXT,
  "messageId" TEXT,
  "campaignMessageId" TEXT,
  "destinationUrl" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "link_click_events_workspaceId_createdAt_idx" ON "link_click_events"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "link_click_events_trackingToken_idx" ON "link_click_events"("trackingToken");

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "assetType" TEXT NOT NULL DEFAULT 'image',
  "mimeType" TEXT,
  "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "storageUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "media_assets_workspaceId_createdAt_idx" ON "media_assets"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "surveys" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "surveyType" TEXT NOT NULL DEFAULT 'poll',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "questions" JSONB NOT NULL DEFAULT '[]',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "surveys_workspaceId_status_idx" ON "surveys"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "survey_responses" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "surveyId" TEXT NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE,
  "contactId" TEXT,
  "phone" TEXT,
  "answers" JSONB NOT NULL DEFAULT '{}',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "survey_responses_surveyId_submittedAt_idx" ON "survey_responses"("surveyId", "submittedAt");

CREATE TABLE IF NOT EXISTS "grow_widgets" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "widgetType" TEXT NOT NULL DEFAULT 'popup',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "config" JSONB NOT NULL DEFAULT '{}',
  "linkedFormId" TEXT,
  "views" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "grow_widgets_workspaceId_status_idx" ON "grow_widgets"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "contact_card_profiles" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE,
  "businessName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "email" TEXT,
  "address" TEXT,
  "extraFields" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
