import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { emitSmartRoutingEvent } from "./events";

export async function recordSmsConsent(input: {
  workspaceId: string;
  callerNumber: string;
  businessNumber: string;
  callSessionId?: string;
  contactId?: string;
  affirmativeInput: string;
  promptAssetId?: string;
  promptVersion?: string;
  consentScope?: string;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const existing = await prisma.smartRoutingSmsConsentEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callSessionId: input.callSessionId ?? undefined,
      callerNumber: input.callerNumber,
    },
    orderBy: { consentedAt: "desc" },
  });
  if (existing && input.callSessionId) {
    return { consent: existing, duplicate: true };
  }

  const consent = await prisma.smartRoutingSmsConsentEvent.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      callerNumber: input.callerNumber,
      businessNumber: input.businessNumber,
      callSessionId: input.callSessionId ?? null,
      contactId: input.contactId ?? null,
      method: "IVR_DTMF",
      affirmativeInput: input.affirmativeInput,
      promptAssetId: input.promptAssetId ?? null,
      promptVersion: input.promptVersion ?? null,
      consentScope: input.consentScope ?? "CUSTOMER_CARE_SMS",
      metadataJson: (input.metadata ?? {}) as object,
    },
  });

  await emitSmartRoutingEvent({
    workspaceId: input.workspaceId,
    type: "SMS_CONSENT_CAPTURED",
    sessionId: input.callSessionId,
    contactId: input.contactId,
    payload: { caller: input.callerNumber, scope: consent.consentScope },
  });

  return { consent, duplicate: false };
}

export async function triggerMissedCallTextFromConsent(input: {
  workspaceId: string;
  callerNumber: string;
  businessNumber: string;
  callSessionId: string;
  isTest?: boolean;
}) {
  if (input.isTest) {
    return { triggered: false, reason: "test_mode" };
  }

  await emitSmartRoutingEvent({
    workspaceId: input.workspaceId,
    type: "MISSED_CALL_TEXT_REQUESTED",
    sessionId: input.callSessionId,
    payload: { caller: input.callerNumber, business: input.businessNumber },
  });

  const { processMissedInboundCall } = await import(
    "@/lib/agents/missed-call-text-back/process"
  );

  const prisma = getPrisma();
  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: input.businessNumber },
  });

  const result = await processMissedInboundCall({
    workspaceId: input.workspaceId,
    callerE164: input.callerNumber,
    businessE164: input.businessNumber,
    phoneNumberId: pn?.id,
    providerCallId: input.callSessionId,
    call: {
      direction: "INBOUND",
      status: "NO_ANSWER",
      disposition: "missed",
      answeredAt: null,
      voicemailDetected: false,
    },
  });

  return result;
}
