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
export async function resolvePhoneFoundationForVoiceV3Session(input: {
  workspaceId: string;
  callerE164?: string | null;
  businessLineE164?: string | null;
  humanCallIdHint?: string | null;
  inboundCallControlIdHint?: string | null;
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

  const caller = input.callerE164?.trim();
  const businessLine = input.businessLineE164?.trim();
  if (!caller || !businessLine) return undefined;

  let normalizedCaller: string;
  let normalizedLine: string;
  try {
    normalizedCaller = normalizeE164(caller);
    normalizedLine = normalizeE164(businessLine);
  } catch {
    return undefined;
  }

  const since = new Date(Date.now() - LOOKUP_WINDOW_MS);
  const candidates = await getPrisma().humanCall.findMany({
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
    if (!row.phoneNumberId) continue;
    const inboundCallControlId = resolveTransferControlId(row);
    if (!inboundCallControlId) continue;
    return {
      humanCallId: row.id,
      inboundCallControlId,
      workspaceId,
      phoneNumberId: row.phoneNumberId,
    };
  }

  return undefined;
}
