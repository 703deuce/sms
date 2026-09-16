-- CreateTable
CREATE TABLE "voice_v2_ai_call_recovery_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "agentId" TEXT,
    "callerE164" TEXT NOT NULL,
    "sendingPhoneNumberId" TEXT,
    "sendingE164" TEXT,
    "resolutionStatus" TEXT NOT NULL,
    "primaryOutcome" TEXT NOT NULL,
    "deliveryDecision" TEXT NOT NULL,
    "recoverySubtype" TEXT,
    "continuationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "continuationSource" TEXT NOT NULL DEFAULT 'VOICE_CALL',
    "structuredState" JSONB NOT NULL,
    "voiceTranscriptTurns" JSONB NOT NULL,
    "actionTimeline" JSONB,
    "callSummary" TEXT,
    "smsConversationId" TEXT,
    "recoverySmsSentAt" TIMESTAMP(3),
    "recoverySmsStatus" TEXT,
    "recoveryIdempotencyKey" TEXT NOT NULL,
    "callerRepliedAt" TIMESTAMP(3),
    "continuationStartedAt" TIMESTAMP(3),
    "finalConversion" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_v2_ai_call_recovery_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voice_v2_ai_call_recovery_sessions_recoveryIdempotencyKey_key" ON "voice_v2_ai_call_recovery_sessions"("recoveryIdempotencyKey");

-- CreateIndex
CREATE INDEX "voice_v2_ai_call_recovery_sessions_voiceCallId_idx" ON "voice_v2_ai_call_recovery_sessions"("voiceCallId");

-- CreateIndex
CREATE INDEX "voice_v2_ai_call_recovery_sessions_smsConversationId_idx" ON "voice_v2_ai_call_recovery_sessions"("smsConversationId");

-- CreateIndex
CREATE INDEX "voice_v2_ai_call_recovery_sessions_workspaceId_callerE164_sending_idx" ON "voice_v2_ai_call_recovery_sessions"("workspaceId", "callerE164", "sendingE164", "createdAt");

-- AddForeignKey
ALTER TABLE "voice_v2_ai_call_recovery_sessions" ADD CONSTRAINT "voice_v2_ai_call_recovery_sessions_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_v2_ai_call_recovery_sessions" ADD CONSTRAINT "voice_v2_ai_call_recovery_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
