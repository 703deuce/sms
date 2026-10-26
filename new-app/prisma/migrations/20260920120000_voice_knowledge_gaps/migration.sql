-- CreateTable
CREATE TABLE "voice_knowledge_gaps" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "normalizedQuestion" TEXT NOT NULL,
    "displayQuestion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "timesAsked" INTEGER NOT NULL DEFAULT 1,
    "firstAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceCallIds" JSONB NOT NULL DEFAULT '[]',
    "recentWording" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_knowledge_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_knowledge_gaps_workspaceId_status_idx" ON "voice_knowledge_gaps"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "voice_knowledge_gaps_workspaceId_normalizedQuestion_key" ON "voice_knowledge_gaps"("workspaceId", "normalizedQuestion");

-- AddForeignKey
ALTER TABLE "voice_knowledge_gaps" ADD CONSTRAINT "voice_knowledge_gaps_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
