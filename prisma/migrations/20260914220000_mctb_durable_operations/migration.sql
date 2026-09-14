-- CreateTable
CREATE TABLE "mctb_durable_operations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "voiceCallId" TEXT,
    "operationType" TEXT NOT NULL,
    "stateVersion" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "claimLeaseExpiresAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inputJson" JSONB NOT NULL DEFAULT '{}',
    "resultJson" JSONB,
    "failureClass" TEXT,
    "failureDetail" TEXT,
    "traceJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mctb_durable_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mctb_durable_operations_idempotencyKey_key" ON "mctb_durable_operations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "mctb_durable_operations_workspaceId_status_nextAttemptAt_idx" ON "mctb_durable_operations"("workspaceId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "mctb_durable_operations_voiceCallId_status_idx" ON "mctb_durable_operations"("voiceCallId", "status");

-- CreateIndex
CREATE INDEX "mctb_durable_operations_conversationId_status_idx" ON "mctb_durable_operations"("conversationId", "status");

-- CreateIndex
CREATE INDEX "mctb_durable_operations_status_claimLeaseExpiresAt_idx" ON "mctb_durable_operations"("status", "claimLeaseExpiresAt");

-- AddForeignKey
ALTER TABLE "mctb_durable_operations" ADD CONSTRAINT "mctb_durable_operations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
