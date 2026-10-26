-- S10: clip montages
CREATE TABLE IF NOT EXISTS "clip_montages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clipIds" JSONB NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "outputKey" TEXT,
    "posterKey" TEXT,
    "durationMs" INTEGER,
    "sizeBytes" BIGINT,
    "error" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clip_montages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clip_montages_workspaceId_projectId_idx" ON "clip_montages"("workspaceId", "projectId");

ALTER TABLE "clip_montages" ADD CONSTRAINT "clip_montages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clip_montages" ADD CONSTRAINT "clip_montages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
