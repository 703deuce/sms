import "server-only";

import { handleMctbInboundEvent } from "@/lib/mctb/event-only/handle";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";
import { normalizeSipMctbInboundEvent } from "@/lib/mctb/event-only/normalize";

const FALLBACK_WORKSPACE_ID =
  process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";

export type CaptureMctbSipInboundInput = {
  providerCallId: string;
  callerE164: string;
  transovoNumberE164?: string;
  forwardedFromE164?: string | null;
  diversionHeader?: string | null;
  connectionId?: string | null;
  livekitRoomName?: string | null;
  participantIdentity?: string | null;
  sipAttributes?: Record<string, string>;
  receivedAt?: string;
  fallbackWorkspaceId?: string;
};

/**
 * Adapt LiveKit/Telnyx SIP ingress into the shared MCTB EVENT_ONLY business pipeline.
 * SMS scheduling is independent of voice/media success.
 */
export async function captureMctbSipInboundForPython(input: CaptureMctbSipInboundInput) {
  const normalized = normalizeSipMctbInboundEvent({
    providerCallId: input.providerCallId,
    callerE164: input.callerE164,
    transovoNumberE164: input.transovoNumberE164,
    forwardedFromE164: input.forwardedFromE164,
    diversionHeader: input.diversionHeader,
    connectionId: input.connectionId,
    livekitRoomName: input.livekitRoomName,
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : undefined,
    sipAttributes: input.sipAttributes,
  });

  if (!normalized) {
    return { ok: false, error: "invalid_sip_mctb_payload" };
  }

  logMctbEventOnly("mctb_sip_inbound_captured", {
    providerCallId: normalized.providerCallId,
    caller: normalized.callerE164,
    transovoNumber: normalized.transovoNumberE164,
    forwardedFrom: normalized.forwardedFromE164 || null,
    connectionId: normalized.connectionId || null,
    livekitRoomName: input.livekitRoomName || null,
    participantIdentity: input.participantIdentity || null,
  });

  const result = await handleMctbInboundEvent(normalized, {
    fallbackWorkspaceId: input.fallbackWorkspaceId || FALLBACK_WORKSPACE_ID,
  });

  return { ...result, captured: true };
}
