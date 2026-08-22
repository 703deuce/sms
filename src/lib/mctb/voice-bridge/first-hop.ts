import { createHash, randomBytes } from "node:crypto";
import {
  MCTB_PLATFORM_DEMO_E164,
  MCTB_TWILIO_VOICE_INGRESS_E164,
} from "@/lib/mctb/onboarding/constants";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import { parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";
import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export const MCTB_VOICE_BRIDGE_LOG_SOURCE = "mctb-voice-bridge";

export const MCTB_VOICE_BRIDGE_CORRELATION_WINDOW_MS = 5 * 60 * 1000;

export type MctbVoiceBridgeTelnyxPayload = {
  call_control_id?: string;
  call_session_id?: string;
  call_leg_id?: string;
  connection_id?: string;
  from?: string;
  to?: string;
  direction?: string;
  sip_headers?: unknown;
};

export function logMctbVoiceBridge(event: string, extra: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      source: MCTB_VOICE_BRIDGE_LOG_SOURCE,
      event,
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

function summarizeDiversionHeader(payload: MctbVoiceBridgeTelnyxPayload): string | null {
  const headers = payload.sip_headers;
  if (!Array.isArray(headers)) return null;
  for (const raw of headers) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as { name?: string; value?: string };
    if (String(row.name || "").toLowerCase() === "diversion") {
      return String(row.value || "").slice(0, 500) || null;
    }
  }
  return null;
}

function hashCorrelationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createBridgeCorrelationToken(): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = randomBytes(24).toString("base64url");
  return {
    token,
    tokenHash: hashCorrelationToken(token),
    expiresAt: new Date(Date.now() + MCTB_VOICE_BRIDGE_CORRELATION_WINDOW_MS),
  };
}

export function isMctb571InboundTarget(to: string): boolean {
  try {
    return normalizeE164(to) === MCTB_PLATFORM_DEMO_E164;
  } catch {
    return to === MCTB_PLATFORM_DEMO_E164;
  }
}

export async function captureMctbVoiceBridgeFirstHop(input: {
  eventPayload: MctbVoiceBridgeTelnyxPayload;
  fallbackWorkspaceId: string;
}): Promise<{
  callEventId: string;
  created: boolean;
  correlationToken: string;
}> {
  const callControlId = String(input.eventPayload.call_control_id || "");
  if (!callControlId) throw new Error("Missing Telnyx call_control_id");

  const callerE164 = normalizeE164(String(input.eventPayload.from || ""));
  const transovoNumberE164 = normalizeE164(String(input.eventPayload.to || ""));
  const businessNumberE164 =
    parseTelnyxForwardedFrom(input.eventPayload as Record<string, unknown>) || null;
  const diversionHeader = summarizeDiversionHeader(input.eventPayload);

  const target = await resolveMctbTargetWorkspaceForInboundCall({
    callerE164,
    businessE164: transovoNumberE164,
    fallbackWorkspaceId: input.fallbackWorkspaceId,
    forwardedFrom: businessNumberE164,
  });

  const correlation = createBridgeCorrelationToken();
  const prisma = getPrisma();

  const existing = await prisma.mctbVoiceBridgeCallEvent.findUnique({
    where: { telnyxCallControlId: callControlId },
    select: { id: true },
  });
  if (existing) {
    logMctbVoiceBridge("first_hop_duplicate_ignored", {
      callControlId,
      callEventId: existing.id,
    });
    return { callEventId: existing.id, created: false, correlationToken: correlation.token };
  }

  const row = await prisma.mctbVoiceBridgeCallEvent.create({
    data: {
      workspaceId: target.workspaceId,
      callerE164,
      transovoNumberE164,
      businessNumberE164,
      telnyxCallControlId: callControlId,
      telnyxCallSessionId: input.eventPayload.call_session_id
        ? String(input.eventPayload.call_session_id)
        : null,
      telnyxCallLegId: input.eventPayload.call_leg_id
        ? String(input.eventPayload.call_leg_id)
        : null,
      telnyxProviderCallId: input.eventPayload.call_session_id
        ? String(input.eventPayload.call_session_id)
        : input.eventPayload.call_leg_id
          ? String(input.eventPayload.call_leg_id)
          : null,
      telnyxConnectionId: input.eventPayload.connection_id
        ? String(input.eventPayload.connection_id)
        : null,
      diversionHeader,
      voiceBridgeStatus: "FIRST_HOP_CAPTURED",
      correlationStatus: "PENDING",
      bridgeCorrelationTokenHash: correlation.tokenHash,
      bridgeCorrelationExpiresAt: correlation.expiresAt,
      smsFromE164: transovoNumberE164,
      smsToE164: callerE164,
      smsProvider: "TELNYX",
      metadata: {
        isPlatformDemo: target.isPlatformDemo,
        demoMode: target.demoMode,
        twilioIngressE164: MCTB_TWILIO_VOICE_INGRESS_E164,
      },
    },
  });

  logMctbVoiceBridge("first_hop_captured", {
    caller: callerE164,
    transovoNumber: transovoNumberE164,
    businessNumber: businessNumberE164,
    callEventId: row.id,
    callControlId,
  });

  return { callEventId: row.id, created: true, correlationToken: correlation.token };
}

export async function markMctbVoiceBridgeTransferRequested(input: {
  callEventId: string;
  callControlId: string;
}) {
  const prisma = getPrisma();
  await prisma.mctbVoiceBridgeCallEvent.update({
    where: { id: input.callEventId },
    data: {
      voiceBridgeStatus: "TRANSFER_REQUESTED",
    },
  });
  logMctbVoiceBridge("transfer_requested", {
    callEventId: input.callEventId,
    callControlId: input.callControlId,
    to: MCTB_TWILIO_VOICE_INGRESS_E164,
  });
}

export async function correlateTwilioIngressToFirstHop(input: {
  callSid: string;
  fromE164: string;
  toE164: string;
  forwardedFromE164?: string | null;
}): Promise<{
  callEventId: string | null;
  correlationMethod: string;
}> {
  const prisma = getPrisma();
  const callerE164 = normalizeE164(input.fromE164);
  const ingressE164 = normalizeE164(input.toE164);
  const since = new Date(Date.now() - MCTB_VOICE_BRIDGE_CORRELATION_WINDOW_MS);

  const existingBySid = await prisma.mctbVoiceBridgeCallEvent.findUnique({
    where: { twilioCallSid: input.callSid },
    select: { id: true },
  });
  if (existingBySid) {
    return {
      callEventId: existingBySid.id,
      correlationMethod: "twilio_call_sid_idempotent",
    };
  }

  const candidate = await prisma.mctbVoiceBridgeCallEvent.findFirst({
    where: {
      callerE164,
      transovoNumberE164: MCTB_PLATFORM_DEMO_E164,
      firstHopReceivedAt: { gte: since },
      twilioCallSid: null,
      voiceBridgeStatus: { in: ["FIRST_HOP_CAPTURED", "TRANSFER_REQUESTED"] },
    },
    orderBy: { firstHopReceivedAt: "desc" },
  });

  if (!candidate) {
    return { callEventId: null, correlationMethod: "ani_to_timestamp_window_miss" };
  }

  await prisma.mctbVoiceBridgeCallEvent.update({
    where: { id: candidate.id },
    data: {
      twilioCallSid: input.callSid,
      correlationStatus: "MATCHED",
      voiceBridgeStatus: "TWILIO_CORRELATED",
      metadata: {
        ...(typeof candidate.metadata === "object" && candidate.metadata
          ? (candidate.metadata as Record<string, unknown>)
          : {}),
        twilioIngressE164: ingressE164,
        twilioForwardedFrom: input.forwardedFromE164 || null,
        correlationMethod: "ani_to_timestamp_window",
        correlatedAt: new Date().toISOString(),
      },
    },
  });

  return { callEventId: candidate.id, correlationMethod: "ani_to_timestamp_window" };
}

/** Test helper — PostgREST requires a WHERE clause on DELETE. */
export async function resetMctbVoiceBridgeForTests(): Promise<void> {
  const prisma = getPrisma();
  await prisma.mctbVoiceBridgeCallEvent.deleteMany({
    where: { createdAt: { gte: new Date(0) } },
  });
}
