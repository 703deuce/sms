import type OpenAI from "openai";
import { getVoiceV3BasicOpenAiClient } from "./openai-client";
import {
  buildBasicLiveSessionAcceptParams,
  logVoiceV3BasicConfigOnce,
} from "./live-session-config";

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
  return null;
}

export function parseOpenAiLiveWebhookBody(raw: string): UnknownEvent {
  return JSON.parse(raw) as UnknownEvent;
}

/**
 * Verify signature when OPENAI_WEBHOOK_SECRET is set; otherwise parse JSON only (dev).
 */
export function unwrapOpenAiWebhook(
  client: OpenAI,
  rawBody: string,
  headers: Headers,
): UnknownEvent {
  const secret = process.env.OPENAI_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return parseOpenAiLiveWebhookBody(rawBody);
  }
  const headerRecord: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerRecord[key] = value;
  });
  const event = client.webhooks.unwrap(rawBody, headerRecord);
  return event as UnknownEvent;
}

async function attachSidebandObserver(sessionId: string): Promise<void> {
  if (process.env.VOICE_V3_BASIC_SIDEBAND_OBSERVER === "0") return;
  try {
    const { SidebandWS } = await import("openai/resources/live/sideband/ws");
    const client = getVoiceV3BasicOpenAiClient();
    const sideband = new SidebandWS(client, { session_id: sessionId });
    sideband.on("event", (serverEvent: { type?: string; delegation?: unknown; event?: unknown }) => {
      const type = serverEvent?.type;
      if (type === "session.delegation.created") {
        console.log("VOICE_V3_BASIC_DELEGATION_CREATED", { sessionId, delegation: serverEvent.delegation });
      } else if (type === "response.event") {
        const nested = serverEvent.event as { type?: string } | undefined;
        console.log("VOICE_V3_BASIC_ASTRA_RESPONSE_EVENT", {
          sessionId,
          nestedType: nested?.type,
        });
      } else if (type === "session.closed") {
        console.log("VOICE_V3_BASIC_SESSION_CLOSED", { sessionId });
        sideband.close();
      }
    });
    sideband.on("error", (err: unknown) => {
      console.error("VOICE_V3_BASIC_SIDEBAND_ERROR", { sessionId, err });
    });
  } catch (err) {
    console.error("VOICE_V3_BASIC_SIDEBAND_ATTACH_FAILED", { sessionId, err });
  }
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
    event = unwrapOpenAiWebhook(client, input.rawBody, input.headers);
  } catch (err) {
    console.error("OPENAI_LIVE_WEBHOOK_UNWRAP_FAILED", err);
    throw err;
  }

  console.log("OPENAI_LIVE_WEBHOOK", {
    type: event.type,
    id: event.id,
  });

  if (event.type === "realtime.call.incoming") {
    console.log("OPENAI_LIVE_WEBHOOK_IGNORED_REALTIME_INCOMING", {
      reason: "voice_v3_basic_uses_live_transport_only",
      callId: event.data?.call_id,
    });
    return { handled: true, accepted: false, reason: "ignored_realtime_call_incoming" };
  }

  if (event.type !== "live.transport.incoming" && event.type !== "live.call.incoming") {
    return { handled: false, reason: `ignored_event_type:${event.type ?? "unknown"}` };
  }

  const sessionId = extractLiveSessionIdFromWebhookEvent(event);
  if (!sessionId) {
    console.error("OPENAI_LIVE_MISSING_SESSION_ID", event);
    return { handled: true, accepted: false, reason: "missing_session_id" };
  }

  console.log("OPENAI_LIVE_INCOMING", { sessionId });

  await client.live.sessions.accept(sessionId, buildBasicLiveSessionAcceptParams());

  console.log("OPENAI_LIVE_CALL_ACCEPTED", {
    sessionId,
    liveModel: "gpt-live-1",
    backendModel: "gpt-6-astra",
  });

  void attachSidebandObserver(sessionId);

  return { handled: true, sessionId, accepted: true };
}
