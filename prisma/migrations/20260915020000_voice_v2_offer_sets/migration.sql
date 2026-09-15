-- Voice Booking V2 primitive #2: offer sets + book idempotency

CREATE TABLE "voice_v2_offer_sets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "voiceCallId" TEXT,
    "slotsJson" JSONB NOT NULL,
    "serviceName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "connectionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_v2_offer_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "voice_v2_booking_idempotency" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "offerSetId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "microsoftEventId" TEXT,
    "voiceAppointmentId" TEXT,
    "resultJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_v2_booking_idempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "voice_v2_booking_idempotency_idempotencyKey_key" ON "voice_v2_booking_idempotency"("idempotencyKey");

CREATE INDEX "voice_v2_offer_sets_workspaceId_expiresAt_idx" ON "voice_v2_offer_sets"("workspaceId", "expiresAt");
CREATE INDEX "voice_v2_offer_sets_voiceCallId_idx" ON "voice_v2_offer_sets"("voiceCallId");
CREATE INDEX "voice_v2_booking_idempotency_workspaceId_createdAt_idx" ON "voice_v2_booking_idempotency"("workspaceId", "createdAt");

ALTER TABLE "voice_v2_offer_sets" ADD CONSTRAINT "voice_v2_offer_sets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_v2_booking_idempotency" ADD CONSTRAINT "voice_v2_booking_idempotency_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
