-- CreateEnum
CREATE TYPE "GenerationKind" AS ENUM ('BROLL_VIDEO', 'MUSIC', 'SFX', 'THUMBNAIL', 'DUB');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clipId" TEXT,
    "kind" "GenerationKind" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'kie',
    "providerTaskId" TEXT,
    "prompt" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "storageKey" TEXT,
    "costUsd" DECIMAL(10,4),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_generations_workspaceId_idx" ON "ai_generations"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_generations_clipId_idx" ON "ai_generations"("clipId");

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
