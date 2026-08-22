import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import {
  EXISTING_CONSENT_ATTESTATION,
  EXISTING_CONSENT_METHOD,
  EXISTING_CONSENT_SCOPE,
} from "@/lib/mctb/consent-mode";

/** Persist existing-consent attestation when recovery SMS proceeds without Press-1. */
export async function recordExistingConsentAttestation(input: {
  workspaceId: string;
  callerNumber: string;
  businessNumber: string;
  voiceCallId?: string | null;
  contactId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const recent = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callerNumber: input.callerNumber,
      businessNumber: input.businessNumber,
      method: EXISTING_CONSENT_METHOD,
      consentedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    orderBy: { consentedAt: "desc" },
  });
  if (recent) return { consent: recent, duplicate: true as const };

  const consent = await prisma.smartRoutingSmsConsentEvent.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      callerNumber: input.callerNumber,
      businessNumber: input.businessNumber,
      callSessionId: input.voiceCallId || null,
      contactId: input.contactId || null,
      method: EXISTING_CONSENT_METHOD,
      affirmativeInput: EXISTING_CONSENT_ATTESTATION,
      consentScope: EXISTING_CONSENT_SCOPE,
      metadataJson: {
        source: "missed_call_recovery",
        attestation: "workspace_existing_consent_mode",
        ...(input.metadata || {}),
      } as object,
    },
  });

  return { consent, duplicate: false as const };
}
