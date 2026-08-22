-- MCTB Telnyx first-hop voice bridge call events (571 → Twilio ingress)
CREATE TABLE IF NOT EXISTS "mctb_voice_bridge_call_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "callerE164" TEXT NOT NULL,
    "transovoNumberE164" TEXT NOT NULL,
    "businessNumberE164" TEXT,
    "telnyxCallControlId" TEXT NOT NULL,
    "telnyxCallSessionId" TEXT,
    "telnyxCallLegId" TEXT,
    "telnyxProviderCallId" TEXT,
    "telnyxConnectionId" TEXT,
    "diversionHeader" TEXT,
    "firstHopReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voiceBridgeStatus" TEXT NOT NULL DEFAULT 'FIRST_HOP_CAPTURED',
    "twilioCallSid" TEXT,
    "correlationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "bridgeCorrelationTokenHash" TEXT,
    "bridgeCorrelationExpiresAt" TIMESTAMP(3),
    "consentMode" TEXT,
    "consentStatus" TEXT,
    "consentAt" TIMESTAMP(3),
    "smsEligibilityStatus" TEXT,
    "smsScheduledAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),
    "smsProvider" TEXT,
    "smsFromE164" TEXT,
    "smsToE164" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mctb_voice_bridge_call_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mctb_voice_bridge_call_events_telnyxCallControlId_key"
    ON "mctb_voice_bridge_call_events"("telnyxCallControlId");

CREATE UNIQUE INDEX IF NOT EXISTS "mctb_voice_bridge_call_events_twilioCallSid_key"
    ON "mctb_voice_bridge_call_events"("twilioCallSid");

CREATE INDEX IF NOT EXISTS "mctb_voice_bridge_call_events_workspaceId_firstHopReceivedAt_idx"
    ON "mctb_voice_bridge_call_events"("workspaceId", "firstHopReceivedAt");

CREATE INDEX IF NOT EXISTS "mctb_voice_bridge_call_events_caller_transovo_firstHop_idx"
    ON "mctb_voice_bridge_call_events"("callerE164", "transovoNumberE164", "firstHopReceivedAt");

CREATE INDEX IF NOT EXISTS "mctb_voice_bridge_call_events_correlation_firstHop_idx"
    ON "mctb_voice_bridge_call_events"("correlationStatus", "firstHopReceivedAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mctb_voice_bridge_call_events_workspaceId_fkey'
    ) THEN
        ALTER TABLE "mctb_voice_bridge_call_events"
            ADD CONSTRAINT "mctb_voice_bridge_call_events_workspaceId_fkey"
            FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
