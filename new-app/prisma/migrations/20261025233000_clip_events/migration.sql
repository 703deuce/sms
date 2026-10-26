CREATE TABLE "clip_events" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clip_events_clipId_createdAt_idx" ON "clip_events"("clipId", "createdAt");
CREATE INDEX "clip_events_workspaceId_createdAt_idx" ON "clip_events"("workspaceId", "createdAt");

ALTER TABLE "clip_events" ADD CONSTRAINT "clip_events_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "clips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clip_events" ADD CONSTRAINT "clip_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
