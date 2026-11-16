-- Extend existing agent jobs without altering or dropping current records.
ALTER TABLE "MotionStudioAgentJob"
  ADD COLUMN "parentJobId" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MotionStudioAgentMessage" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "jobId" TEXT,
  "role" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MotionStudioAgentMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MotionStudioAgentMessage_projectId_createdAt_idx"
  ON "MotionStudioAgentMessage" ("projectId", "createdAt");
