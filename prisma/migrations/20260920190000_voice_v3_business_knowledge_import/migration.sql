-- CreateTable
CREATE TABLE "voice_v3_business_knowledge_sources" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "voiceAgentId" TEXT NOT NULL,
    "websiteRootUrl" TEXT,
    "websiteFinalUrl" TEXT,
    "googlePlaceId" TEXT,
    "googleDataId" TEXT,
    "googleLudocid" TEXT,
    "googleDisplayName" TEXT,
    "googleAddress" TEXT,
    "googleWebsite" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_v3_business_knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_v3_business_knowledge_imports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "voiceAgentId" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT NOT NULL DEFAULT 'onboarding',
    "sourceTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pagesJson" JSONB,
    "googleSnapshot" JSONB,
    "candidatesJson" JSONB,
    "reviewJson" JSONB,
    "telemetryJson" JSONB,
    "appliedPatchJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "voice_v3_business_knowledge_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_v3_business_knowledge_sources_voiceAgentId_key" ON "voice_v3_business_knowledge_sources"("voiceAgentId");

-- CreateIndex
CREATE INDEX "voice_v3_business_knowledge_sources_workspaceId_idx" ON "voice_v3_business_knowledge_sources"("workspaceId");

-- CreateIndex
CREATE INDEX "voice_v3_business_knowledge_imports_workspaceId_voiceAgentId_c_idx" ON "voice_v3_business_knowledge_imports"("workspaceId", "voiceAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_v3_business_knowledge_imports_voiceAgentId_status_idx" ON "voice_v3_business_knowledge_imports"("voiceAgentId", "status");

-- AddForeignKey
ALTER TABLE "voice_v3_business_knowledge_sources" ADD CONSTRAINT "voice_v3_business_knowledge_sources_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_v3_business_knowledge_sources" ADD CONSTRAINT "voice_v3_business_knowledge_sources_voiceAgentId_fkey" FOREIGN KEY ("voiceAgentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_v3_business_knowledge_imports" ADD CONSTRAINT "voice_v3_business_knowledge_imports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_v3_business_knowledge_imports" ADD CONSTRAINT "voice_v3_business_knowledge_imports_voiceAgentId_fkey" FOREIGN KEY ("voiceAgentId") REFERENCES "voice_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_v3_business_knowledge_imports" ADD CONSTRAINT "voice_v3_business_knowledge_imports_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "voice_v3_business_knowledge_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
