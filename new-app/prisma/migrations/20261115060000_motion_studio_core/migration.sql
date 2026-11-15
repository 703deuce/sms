-- Motion Studio core (#1210 BE-1). ADDITIVE ONLY: new tables, no change to existing tables.
CREATE TABLE IF NOT EXISTS "MotionStudioProject" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "director" TEXT NOT NULL DEFAULT 'documentary',
  "clipProjectId" TEXT,
  "clipId" TEXT,
  "title" TEXT NOT NULL,
  "brief" TEXT NOT NULL DEFAULT '',
  "workflow" TEXT NOT NULL,
  "settings" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "stage" TEXT NOT NULL DEFAULT 'story',
  "stages" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "story" JSONB,
  "plan" JSONB,
  "narration" JSONB,
  "music" JSONB,
  "qa" JSONB,
  "exportInfo" JSONB,
  "proposals" JSONB,
  "timelineVersion" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "errorStage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "MotionStudioProject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MotionStudioProject_workspaceId_idempotencyKey_key" ON "MotionStudioProject"("workspaceId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "MotionStudioProject_workspaceId_createdAt_idx" ON "MotionStudioProject"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "MotionStudioScene" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  "chapter" INTEGER NOT NULL DEFAULT 0,
  "kind" TEXT NOT NULL DEFAULT 'graphics',
  "visualType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "plan" JSONB NOT NULL,
  "startMs" INTEGER NOT NULL DEFAULT 0,
  "endMs" INTEGER NOT NULL DEFAULT 0,
  "model" TEXT,
  "codeKey" TEXT,
  "codeHash" TEXT,
  "fixRounds" INTEGER NOT NULL DEFAULT 0,
  "usedFallback" BOOLEAN NOT NULL DEFAULT false,
  "qa" JSONB,
  "renderKey" TEXT,
  "renderHash" TEXT,
  "stillKey" TEXT,
  "audioKey" TEXT,
  "handoff" JSONB,
  "cues" JSONB,
  "error" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MotionStudioScene_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MotionStudioScene_projectId_index_key" ON "MotionStudioScene"("projectId", "index");
CREATE INDEX IF NOT EXISTS "MotionStudioScene_projectId_status_idx" ON "MotionStudioScene"("projectId", "status");

CREATE TABLE IF NOT EXISTS "StudioAsset" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "filename" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "analysis" JSONB,
  "provenanceLog" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudioAsset_projectId_uploadId_key" ON "StudioAsset"("projectId", "uploadId");
CREATE INDEX IF NOT EXISTS "StudioAsset_projectId_idx" ON "StudioAsset"("projectId");

CREATE TABLE IF NOT EXISTS "StudioActivityEvent" (
  "id" SERIAL NOT NULL,
  "projectId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudioActivityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StudioActivityEvent_projectId_id_idx" ON "StudioActivityEvent"("projectId", "id");

CREATE TABLE IF NOT EXISTS "MotionStudioSandboxExec" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sceneId" TEXT,
  "mode" TEXT NOT NULL,
  "ok" BOOLEAN NOT NULL,
  "errorKind" TEXT,
  "error" TEXT,
  "codeHash" TEXT,
  "model" TEXT,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MotionStudioSandboxExec_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MotionStudioSandboxExec_projectId_createdAt_idx" ON "MotionStudioSandboxExec"("projectId", "createdAt");
