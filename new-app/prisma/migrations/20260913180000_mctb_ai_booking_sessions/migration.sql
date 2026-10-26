-- CreateTable
CREATE TABLE "mctb_ai_booking_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'IDLE',
    "provider" TEXT,
    "schedulingTargetJson" JSONB,
    "requestedWindowJson" JSONB,
    "offeredSlotsJson" JSONB,
    "selectedSlotJson" JSONB,
    "providerBookingId" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mctb_ai_booking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mctb_conversation_booking_activities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "contactId" TEXT,
    "kind" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mctb_conversation_booking_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mctb_ai_booking_sessions_conversationId_key" ON "mctb_ai_booking_sessions"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "mctb_ai_booking_sessions_idempotencyKey_key" ON "mctb_ai_booking_sessions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "mctb_ai_booking_sessions_workspaceId_updatedAt_idx" ON "mctb_ai_booking_sessions"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "mctb_conversation_booking_activities_conversationId_createdAt_idx" ON "mctb_conversation_booking_activities"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "mctb_conversation_booking_activities_workspaceId_createdAt_idx" ON "mctb_conversation_booking_activities"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "mctb_ai_booking_sessions" ADD CONSTRAINT "mctb_ai_booking_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mctb_conversation_booking_activities" ADD CONSTRAINT "mctb_conversation_booking_activities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
