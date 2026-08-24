import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import {
  normalizeBusinessE164ForStorage,
  resolveInboundPhoneNumberId,
} from "@/lib/mctb/resolve-inbound-phone-number";
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
  forwardedFrom?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const session = input.callSessionId
    ? await prisma.smartRoutingCallSession.findUnique({
        where: { id: input.callSessionId },
        select: { forwardedFromNumber: true },
      })
    : null;
  const metadataForwarded =
    typeof input.metadata?.forwardedFrom === "string" ? input.metadata.forwardedFrom : null;
  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: input.callerNumber,
    businessE164: input.businessNumber,
    fallbackWorkspaceId: input.workspaceId,
    forwardedFrom: input.forwardedFrom ?? session?.forwardedFromNumber ?? metadataForwarded,
  });
  const workspaceId = target.workspaceId;

  const providerCallId =
    input.callSessionId ||
    (typeof input.metadata?.providerCallId === "string" ? input.metadata.providerCallId : null);

  if (providerCallId) {
    const bySession = await prisma.smartRoutingSmsConsentEvent.findFirst({
      where: {
        workspaceId,
        callerNumber: input.callerNumber,
        callSessionId: providerCallId,
      },
      orderBy: { consentedAt: "desc" },
    });
    if (bySession) {
      return { consent: bySession, duplicate: true };
    }

    const recent = await prisma.smartRoutingSmsConsentEvent.findMany({
      where: {
        workspaceId,
        callerNumber: input.callerNumber,
        consentedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { consentedAt: "desc" },
      take: 20,
    });
    const byMeta = recent.find((row: { metadataJson: unknown }) => {
      const meta = (row.metadataJson || {}) as Record<string, unknown>;
      return meta.providerCallId === providerCallId;
    });
    if (byMeta) {
      return { consent: byMeta, duplicate: true };
    }
  }

  const consent = await prisma.smartRoutingSmsConsentEvent.create({
    data: {
      id: createId(),
      workspaceId,
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
    workspaceId,
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
  forwardedFrom?: string | null;
  eventMetadata?: Record<string, unknown>;
}) {
  if (input.isTest) {
    return { triggered: false, reason: "test_mode" };
  }

  const prisma = getPrisma();

  const session = await prisma.smartRoutingCallSession.findUnique({
    where: { id: input.callSessionId },
    select: { forwardedFromNumber: true },
  });

  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164: input.callerNumber,
    businessE164: input.businessNumber,
    fallbackWorkspaceId: input.workspaceId,
    forwardedFrom: input.forwardedFrom ?? session?.forwardedFromNumber,
  });

  await emitSmartRoutingEvent({
    workspaceId: target.workspaceId,
    type: "MISSED_CALL_TEXT_REQUESTED",
    sessionId: input.callSessionId,
    payload: { caller: input.callerNumber, business: input.businessNumber },
  });

  const { processMissedInboundCall } = await import(
    "@/lib/agents/missed-call-text-back/process"
  );

  const transovoNumberE164 =
    typeof input.eventMetadata?.transovoNumberE164 === "string"
      ? input.eventMetadata.transovoNumberE164
      : input.businessNumber;

  const phoneNumberId = await resolveInboundPhoneNumberId({
    workspaceId: target.workspaceId,
    transovoNumberE164,
    businessE164: input.businessNumber,
    isPlatformDemo: target.isPlatformDemo,
  });

  const businessE164 = normalizeBusinessE164ForStorage(
    input.businessNumber,
    transovoNumberE164,
  );

  const result = await processMissedInboundCall({
    workspaceId: target.workspaceId,
    callerE164: input.callerNumber,
    businessE164,
    phoneNumberId,
    providerCallId: input.callSessionId,
    demoMode: target.demoMode,
    eventMetadata: {
      ...input.eventMetadata,
      transovoNumberE164,
      phoneNumberId,
    },
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
