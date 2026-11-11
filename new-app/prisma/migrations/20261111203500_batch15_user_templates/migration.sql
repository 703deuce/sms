-- Batch 15: additive private user templates + moderated public community.
-- No existing clip/project/template tables are altered.

CREATE TABLE IF NOT EXISTS "clip_user_templates" (
  "id" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "visibility" TEXT NOT NULL DEFAULT 'private',
  "currentRevision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "clip_user_template_revisions" (
  "id" TEXT PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "definition" JSONB NOT NULL,
  "assetManifest" JSONB NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clip_user_template_revisions_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "clip_user_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "clip_user_template_revisions_templateId_revision_key" UNIQUE ("templateId","revision")
);

CREATE TABLE IF NOT EXISTS "clip_template_publications" (
  "id" TEXT PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "creatorUserId" TEXT NOT NULL,
  "creatorName" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'private_draft',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "category" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "aspect" TEXT NOT NULL,
  "clipCount" INTEGER NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "licenseTerms" TEXT NOT NULL,
  "publicDefinition" JSONB NOT NULL,
  "publicPreview" JSONB NOT NULL,
  "rightsAttestation" JSONB NOT NULL,
  "moderationFlags" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "hiddenAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clip_template_publications_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "clip_user_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "clip_template_publications_revisionId_fkey"
    FOREIGN KEY ("revisionId") REFERENCES "clip_user_template_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "clip_template_moderation_events" (
  "id" TEXT PRIMARY KEY,
  "publicationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clip_template_moderation_events_publicationId_fkey"
    FOREIGN KEY ("publicationId") REFERENCES "clip_template_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "clip_template_reports" (
  "id" TEXT PRIMARY KEY,
  "publicationId" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clip_template_reports_publicationId_fkey"
    FOREIGN KEY ("publicationId") REFERENCES "clip_template_publications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "clip_template_rate_limits" (
  "id" TEXT PRIMARY KEY,
  "scope" TEXT NOT NULL,
  "actorKey" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clip_template_rate_limits_scope_actorKey_windowStart_key" UNIQUE ("scope","actorKey","windowStart")
);

CREATE INDEX IF NOT EXISTS "clip_user_templates_workspace_deleted_updated_idx"
  ON "clip_user_templates" ("workspaceId","deletedAt","updatedAt");
CREATE INDEX IF NOT EXISTS "clip_user_templates_workspace_title_idx"
  ON "clip_user_templates" ("workspaceId","title");
CREATE INDEX IF NOT EXISTS "clip_user_template_revisions_workspace_created_idx"
  ON "clip_user_template_revisions" ("workspaceId","createdAt");
CREATE INDEX IF NOT EXISTS "clip_template_publications_state_published_idx"
  ON "clip_template_publications" ("state","publishedAt");
CREATE INDEX IF NOT EXISTS "clip_template_publications_filters_idx"
  ON "clip_template_publications" ("category","aspect","clipCount","durationMs");
CREATE INDEX IF NOT EXISTS "clip_template_publications_creator_state_idx"
  ON "clip_template_publications" ("creatorUserId","state");
CREATE INDEX IF NOT EXISTS "clip_template_publications_template_created_idx"
  ON "clip_template_publications" ("templateId","createdAt");
CREATE INDEX IF NOT EXISTS "clip_template_moderation_events_publication_created_idx"
  ON "clip_template_moderation_events" ("publicationId","createdAt");
CREATE INDEX IF NOT EXISTS "clip_template_moderation_events_actor_created_idx"
  ON "clip_template_moderation_events" ("actorUserId","createdAt");
CREATE INDEX IF NOT EXISTS "clip_template_reports_publication_status_created_idx"
  ON "clip_template_reports" ("publicationId","status","createdAt");
CREATE INDEX IF NOT EXISTS "clip_template_reports_reporter_created_idx"
  ON "clip_template_reports" ("reporterUserId","createdAt");
CREATE INDEX IF NOT EXISTS "clip_template_rate_limits_window_idx"
  ON "clip_template_rate_limits" ("windowStart");
