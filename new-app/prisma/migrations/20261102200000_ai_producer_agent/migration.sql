-- AI Producer Agent v1 run + step logs (additive tables only)

CREATE TABLE "ai_producer_agent_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "phase" TEXT,
    "genre" TEXT NOT NULL DEFAULT 'irl_just_chatting',
    "outputType" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'tiktok',
    "instruction" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sourceSnapshot" JSONB NOT NULL DEFAULT '[]',
    "resultProjectId" TEXT,
    "resultClipId" TEXT,
    "draftEdits" JSONB,
    "producerNotes" JSONB,
    "error" TEXT,
    "costUsdEstimated" DOUBLE PRECISION,
    "geminiUsd" DOUBLE PRECISION,
    "lunaTokensIn" INTEGER NOT NULL DEFAULT 0,
    "lunaTokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ai_producer_agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_producer_agent_runs_workspaceId_createdAt_idx" ON "ai_producer_agent_runs"("workspaceId", "createdAt");

CREATE TABLE "ai_producer_agent_steps" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "phase" TEXT,
    "tool" TEXT NOT NULL,
    "argsSummary" TEXT,
    "resultSummary" TEXT,
    "durationMs" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "estUsd" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_producer_agent_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_producer_agent_steps_runId_stepIndex_idx" ON "ai_producer_agent_steps"("runId", "stepIndex");

ALTER TABLE "ai_producer_agent_steps" ADD CONSTRAINT "ai_producer_agent_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ai_producer_agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
