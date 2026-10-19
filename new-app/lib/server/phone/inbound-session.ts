/** Correlates PSTN + browser legs for inbound WebRTC (see docs/NEW-APP-TELNYX-INBOUND-AUDIT.md). */
export type InboundBridgeStatus =
  | "received"
  | "dialing_browser"
  | "browser_ringing"
  | "browser_answered"
  | "bridged"
  | "forwarded"
  | "failed"
  | "ended";

export type InboundSessionMetadata = {
  inboundBridge?: string;
  inboundBridgeStatus?: InboundBridgeStatus;
  inboundBridgeError?: string;
  inboundDialMode?: string;
  callerCallControlId?: string;
  browserCallControlId?: string | null;
  parentCallControlId?: string;
  webrtcAgentLegId?: string;
  ringTimeoutAt?: string | null;
};

import type { Prisma } from "@prisma/client";

export function patchInboundSession(
  meta: Record<string, unknown>,
  patch: Partial<InboundSessionMetadata>,
): Prisma.InputJsonValue {
  return { ...meta, ...patch } as Prisma.InputJsonValue;
}
