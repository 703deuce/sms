-- CreateTable
CREATE TABLE "clip_project_selects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "snippet" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clip_project_selects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clip_project_selects_projectId_sortOrder_idx" ON "clip_project_selects"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "clip_project_selects_workspaceId_idx" ON "clip_project_selects"("workspaceId");

-- AddForeignKey
ALTER TABLE "clip_project_selects" ADD CONSTRAINT "clip_project_selects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "clip_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clip_project_selects" ADD CONSTRAINT "clip_project_selects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
