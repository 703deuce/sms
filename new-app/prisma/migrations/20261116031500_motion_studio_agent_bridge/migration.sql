CREATE TABLE "MotionStudioAgentJob" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'dispatching',
  "phase" TEXT NOT NULL DEFAULT 'dispatch',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "artifacts" JSONB,
  "resultKey" TEXT,
  "dispatchedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MotionStudioAgentJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MotionStudioAgentJob_projectId_idempotencyKey_key" ON "MotionStudioAgentJob"("projectId", "idempotencyKey");
CREATE INDEX "MotionStudioAgentJob_workspaceId_projectId_createdAt_idx" ON "MotionStudioAgentJob"("workspaceId", "projectId", "createdAt");
