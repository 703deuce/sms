import "server-only";

import { getPrisma } from "@/lib/server/db";
import { createId } from "@/lib/supabase/id";
import { normalizePhoneE164 } from "@/lib/messaging/preferred-sending-number";

export async function recordVoiceBookingLinkVerbalConsent(input: {
  workspaceId: string;
  callId: string;
  agentId?: string | null;
  destinationE164: string;
  senderE164: string;
  affirmativeInput: string;
  disclosureVersion: string;
  configVersion: string;
  bookingUrl: string;
}) {
  const prisma = getPrisma();
  const caller = normalizePhoneE164(input.destinationE164) || input.destinationE164;
  const business = normalizePhoneE164(input.senderE164) || input.senderE164;

  const existing = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callSessionId: input.callId,
      consentScope: "VOICE_BOOKING_LINK",
    },
    orderBy: { consentedAt: "desc" },
  });
  if (existing) return { consent: existing, duplicate: true };

  const consent = await prisma.smartRoutingSmsConsentEvent.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      callerNumber: caller,
      businessNumber: business,
      callSessionId: input.callId,
      method: "VERBAL",
      affirmativeInput: input.affirmativeInput.slice(0, 500),
      consentScope: "VOICE_BOOKING_LINK",
      promptVersion: input.disclosureVersion,
      metadataJson: {
        purpose: "BOOKING_LINK",
        source: "VOICE_CALL",
        agentId: input.agentId ?? null,
        publishedConfigVersion: input.configVersion,
        bookingUrlIdentity: input.bookingUrl,
      },
    },
  });
  return { consent, duplicate: false };
}
