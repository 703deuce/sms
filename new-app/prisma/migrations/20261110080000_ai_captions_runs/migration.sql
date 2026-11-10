-- Additive: standalone AI Captions runs and last-style prefs.
CREATE TABLE IF NOT EXISTS "ai_captions_runs" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "stage" TEXT,
  "progressPercent" INTEGER,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "clientRequestId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "source" JSONB NOT NULL,
  "ingestedProjectId" TEXT,
  "styleId" TEXT,
  "creditEstimate" INTEGER,
  "result" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_captions_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_captions_runs_workspaceId_clientRequestId_key"
  ON "ai_captions_runs"("workspaceId", "clientRequestId");
CREATE INDEX IF NOT EXISTS "ai_captions_runs_workspaceId_status_idx"
  ON "ai_captions_runs"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "ai_captions_workspace_prefs" (
  "workspaceId" TEXT NOT NULL,
  "lastStyleId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_captions_workspace_prefs_pkey" PRIMARY KEY ("workspaceId")
);
