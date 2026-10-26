-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "clipId" TEXT,
    "generationId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "unitType" TEXT NOT NULL,
    "costUsdMicros" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfx_cache" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfx_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_workspaceId_createdAt_idx" ON "ai_usage"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sfx_cache_workspaceId_promptHash_key" ON "sfx_cache"("workspaceId", "promptHash");
