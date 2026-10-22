import "server-only";

import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/receptionist/routing-resolve";
import { resolveTransferControlId } from "@/lib/server/phone/transfer";
import type { VoiceV3CallContext } from "./state/call-context";

const ACTIVE_AI_ORCHESTRATION_STAGE = "ai_active";
const LOOKUP_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Phone foundation calls enter via Telnyx Call Control → SIP → LiveKit.
 * Voice V3 session resolve often only sees `livekit_sip`; correlate the active HumanCall
 * so transfers use Telnyx Dial + Bridge on the PSTN caller leg (not LiveKit SIP REFER).
 */
function foundationFromHumanRow(
  workspaceId: string,
  row: {
    id: string;
    phoneNumberId: string | null;
    telnyxCallControlId: string | null;
    telnyxCallLegId: string | null;
    metadata: unknown;
  },
  inboundOverride?: string | null,
): VoiceV3CallContext["phoneFoundation"] | undefined {
  if (!row.phoneNumberId) return undefined;
  const inboundCallControlId =
    inboundOverride?.trim() || resolveTransferControlId(row);
  if (!inboundCallControlId) return undefined;
  return {
    humanCallId: row.id,
    inboundCallControlId,
    workspaceId,
    phoneNumberId: row.phoneNumberId,
  };
}

export async function resolvePhoneFoundationForVoiceV3Session(input: {
  workspaceId: string;
  callerE164?: string | null;
  businessLineE164?: string | null;
  humanCallIdHint?: string | null;
  inboundCallControlIdHint?: string | null;
  liveSessionId?: string | null;
}): Promise<VoiceV3CallContext["phoneFoundation"] | undefined> {
  const workspaceId = input.workspaceId.trim();
  if (!workspaceId) return undefined;

  const humanHint = input.humanCallIdHint?.trim();
  const inboundHint = input.inboundCallControlIdHint?.trim();

  if (humanHint && inboundHint) {
    const hc = await getPrisma().humanCall.findFirst({
      where: { id: humanHint, workspaceId },
      select: { id: true, phoneNumberId: true },
    });
    if (hc?.phoneNumberId) {
      return {
        humanCallId: humanHint,
        inboundCallControlId: inboundHint,
        workspaceId,
        phoneNumberId: hc.phoneNumberId,
      };
    }
  }

  const prisma = getPrisma();
  const since = new Date(Date.now() - LOOKUP_WINDOW_MS);

  const liveSessionId = input.liveSessionId?.trim();
  if (liveSessionId) {
    const voiceRow = await prisma.voiceCall.findFirst({
      where: {
        workspaceId,
        OR: [
          { id: liveSessionId },
          { metadata: { path: ["liveSessionId"], equals: liveSessionId } },
        ],
      },
      select: { metadata: true },
    });
    const vMeta = (voiceRow?.metadata as Record<string, unknown>) || {};
    const hintedHuman = typeof vMeta.phoneFoundationHumanCallId === "string"
      ? vMeta.phoneFoundationHumanCallId
      : null;
    const hintedInbound = typeof vMeta.inboundCallControlId === "string"
      ? vMeta.inboundCallControlId
      : null;
    if (hintedHuman && hintedInbound) {
      const hc = await prisma.humanCall.findFirst({
        where: { id: hintedHuman, workspaceId },
        select: {
          id: true,
          phoneNumberId: true,
          telnyxCallControlId: true,
          telnyxCallLegId: true,
          metadata: true,
        },
      });
      const fromHints = hc ? foundationFromHumanRow(workspaceId, hc, hintedInbound) : undefined;
      if (fromHints) return fromHints;
    }
  }

  let normalizedCaller: string | null = null;
  let normalizedLine: string | null = null;
  const caller = input.callerE164?.trim();
  const businessLine = input.businessLineE164?.trim();
  try {
    if (caller) normalizedCaller = normalizeE164(caller);
    if (businessLine) normalizedLine = normalizeE164(businessLine);
  } catch {
    normalizedCaller = null;
    normalizedLine = null;
  }

  if (normalizedCaller) {
    const routingSessions = await prisma.phoneCallRoutingSession.findMany({
      where: {
        workspaceId,
        stage: "conversational_ivr",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        humanCallId: true,
        inboundCallControlId: true,
      },
    });
    for (const rs of routingSessions) {
      if (!rs.humanCallId || !rs.inboundCallControlId) continue;
      const hc = await prisma.humanCall.findFirst({
        where: {
          id: rs.humanCallId,
          workspaceId,
          from: normalizedCaller,
          endedAt: null,
        },
        select: {
          id: true,
          phoneNumberId: true,
          telnyxCallControlId: true,
          telnyxCallLegId: true,
          metadata: true,
        },
      });
      const fromRouting = hc
        ? foundationFromHumanRow(workspaceId, hc, rs.inboundCallControlId)
        : undefined;
      if (fromRouting) return fromRouting;
    }
  }

  if (normalizedCaller && normalizedLine) {
    const candidates = await prisma.humanCall.findMany({
      where: {
        workspaceId,
        from: normalizedCaller,
        to: normalizedLine,
        endedAt: null,
        startedAt: { gte: since },
        metadata: {
          path: ["orchestration", "stage"],
          equals: ACTIVE_AI_ORCHESTRATION_STAGE,
        },
      },
      orderBy: { startedAt: "desc" },
      take: 3,
      select: {
        id: true,
        phoneNumberId: true,
        telnyxCallControlId: true,
        telnyxCallLegId: true,
        metadata: true,
      },
    });
    for (const row of candidates) {
      const found = foundationFromHumanRow(workspaceId, row);
      if (found) return found;
    }
  }

  if (normalizedCaller) {
    const callerOnly = await prisma.humanCall.findMany({
      where: {
        workspaceId,
        from: normalizedCaller,
        endedAt: null,
        startedAt: { gte: since },
        metadata: {
          path: ["orchestration", "stage"],
          equals: ACTIVE_AI_ORCHESTRATION_STAGE,
        },
      },
      orderBy: { startedAt: "desc" },
      take: 3,
      select: {
        id: true,
        phoneNumberId: true,
        telnyxCallControlId: true,
        telnyxCallLegId: true,
        metadata: true,
      },
    });
    for (const row of callerOnly) {
      const found = foundationFromHumanRow(workspaceId, row);
      if (found) return found;
    }
  }

  return undefined;
}
