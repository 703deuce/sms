import type OpenAI from "openai";
import { getVoiceV3BasicOpenAiClient } from "./openai-client";
import {
  buildBasicLiveSessionAcceptParams,
  logVoiceV3BasicConfigOnce,
  VOICE_V3_BASIC_BACKEND_MODEL,
  VOICE_V3_BASIC_LIVE_MODEL,
} from "./live-session-config";
import {
  createVoiceV3CallRuntime,
  voiceV3IntakePipelineEnabled,
} from "@/lib/voice-v3/state/call-runtime";
import { attachVoiceV3LiveSideband } from "@/lib/voice-v3/live-sideband-session";
import { consumeRecentPstnLeg, VoiceV3CallTrace } from "@/lib/voice-v3/telemetry/call-trace";

const DEDUP_TTL_MS = 15 * 60 * 1000;
const recentWebhookIds = new Map<string, number>();

export type OpenAiLiveWebhookResult =
  | { handled: true; sessionId: string; accepted: true }
  | { handled: true; accepted: false; reason: string }
  | { handled: false; reason: string };

function pruneWebhookDedup(now: number): void {
  for (const [id, ts] of recentWebhookIds) {
    if (now - ts > DEDUP_TTL_MS) recentWebhookIds.delete(id);
  }
}

export function isDuplicateOpenAiWebhook(webhookId: string | null | undefined): boolean {
  if (!webhookId?.trim()) return false;
  const now = Date.now();
  pruneWebhookDedup(now);
  const id = webhookId.trim();
  if (recentWebhookIds.has(id)) return true;
  recentWebhookIds.set(id, now);
  return false;
}

type UnknownEvent = {
  type?: string;
  id?: string;
  data?: {
    session_id?: string;
    session?: { id?: string };
    call_id?: string;
    type?: string;
  };
};

/** Extract Live session id from live.transport.incoming (and legacy shapes). */
export function extractLiveSessionIdFromWebhookEvent(event: UnknownEvent): string | null {
  const data = event.data;
  if (!data) return null;
  const direct = data.session_id?.trim();
  if (direct) return direct;
  const nested = data.session?.id?.trim();
  if (nested) return nested;
  const callId = data.call_id?.trim();
  if (callId?.startsWith("rtc_")) {
    return `live_${callId.slice(4)}`;
  }
  if (callId?.startsWith("live_")) return callId;
  return null;
}

const INCOMING_SIP_EVENT_TYPES = new Set([
  "live.transport.incoming",
  "live.call.incoming",
  "realtime.call.incoming",
]);

export function isIncomingOpenAiSipWebhookEvent(event: UnknownEvent): boolean {
  if (!event.type) return false;
  return INCOMING_SIP_EVENT_TYPES.has(event.type);
}

export function parseOpenAiLiveWebhookBody(raw: string): UnknownEvent {
  return JSON.parse(raw) as UnknownEvent;
}

/**
 * Verify signature when OPENAI_WEBHOOK_SECRET is set; otherwise parse JSON only (dev).
 */
export async function unwrapOpenAiWebhook(
  client: OpenAI,
  rawBody: string,
  headers: Headers,
): Promise<UnknownEvent> {
  const secret = process.env.OPENAI_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return parseOpenAiLiveWebhookBody(rawBody);
  }
  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerRecord[key] = value;
  });
  const event = await client.webhooks.unwrap(rawBody, headerRecord);
  return event as UnknownEvent;
}

export async function handleOpenAiLiveIncomingWebhook(input: {
  rawBody: string;
  headers: Headers;
}): Promise<OpenAiLiveWebhookResult> {
  logVoiceV3BasicConfigOnce();

  const webhookId = input.headers.get("webhook-id");
  if (isDuplicateOpenAiWebhook(webhookId)) {
    return { handled: true, accepted: false, reason: "duplicate_webhook_id" };
  }

  const client = getVoiceV3BasicOpenAiClient();
  let event: UnknownEvent;
  try {
    event = await unwrapOpenAiWebhook(client, input.rawBody, input.headers);
  } catch (err) {
    console.error("OPENAI_LIVE_WEBHOOK_UNWRAP_FAILED", err);
    throw err;
  }

  console.log("OPENAI_LIVE_WEBHOOK", {
    type: event.type,
    id: event.id,
    callId: event.data?.call_id,
  });

  if (!isIncomingOpenAiSipWebhookEvent(event)) {
    return { handled: false, reason: `ignored_event_type:${event.type ?? "unknown"}` };
  }

  const sessionId = extractLiveSessionIdFromWebhookEvent(event);
  if (!sessionId) {
    console.error("OPENAI_LIVE_MISSING_SESSION_ID", event);
    return { handled: true, accepted: false, reason: "missing_session_id" };
  }

  const trace = VoiceV3CallTrace.getOrCreate({
    liveSessionId: sessionId,
    callId: event.data?.call_id,
    frontendModel: VOICE_V3_BASIC_LIVE_MODEL,
    backendModel: VOICE_V3_BASIC_BACKEND_MODEL,
  });
  const pstnLeg = consumeRecentPstnLeg();
  if (pstnLeg) {
    trace.markAt("pstn.call.received", pstnLeg.atMs, { callControlId: pstnLeg.callControlId });
  }
  trace.mark("live.transport.incoming", { webhookType: event.type, webhookId: event.id });
  trace.mark("webhook.verify.completed");

  console.log("OPENAI_LIVE_INCOMING", { sessionId });

  if (voiceV3IntakePipelineEnabled()) {
    createVoiceV3CallRuntime({
      liveSessionId: sessionId,
      callId: event.data?.call_id,
    });
  }

  trace.mark("session.accept.request.started");
  const acceptParams = buildBasicLiveSessionAcceptParams();
  await client.live.sessions.accept(sessionId, acceptParams);
  trace.mark("session.accept.completed", { liveSessionId: sessionId });

  console.log("VOICE_V3_LIVE_ACCEPTED", {
    sessionId,
    liveModel: VOICE_V3_BASIC_LIVE_MODEL,
    backendModel: VOICE_V3_BASIC_BACKEND_MODEL,
  });

  console.log("OPENAI_LIVE_CALL_ACCEPTED", {
    sessionId,
    liveModel: VOICE_V3_BASIC_LIVE_MODEL,
    backendModel: VOICE_V3_BASIC_BACKEND_MODEL,
  });

  void attachVoiceV3LiveSideband({ sessionId, callId: event.data?.call_id, client });

  return { handled: true, sessionId, accepted: true };
}
