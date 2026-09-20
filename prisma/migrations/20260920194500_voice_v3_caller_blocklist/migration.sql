-- Voice V3 per-workspace caller blocklist (manual blocks)

CREATE TABLE "voice_caller_blocks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callerE164" TEXT NOT NULL,
    "displayName" TEXT,
    "blockedByUserId" TEXT,
    "sourceCallId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_caller_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_caller_blocks_workspaceId_callerE164_key" ON "voice_caller_blocks"("workspaceId", "callerE164");

CREATE INDEX "voice_caller_blocks_workspaceId_createdAt_idx" ON "voice_caller_blocks"("workspaceId", "createdAt");

ALTER TABLE "voice_caller_blocks" ADD CONSTRAINT "voice_caller_blocks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
