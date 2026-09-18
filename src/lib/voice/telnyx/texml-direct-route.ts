/**
 * Direct TeXML → Telnyx AI Assistant inbound routing.
 *
 * Product default for receptionist agents:
 *   Phone → TeXML → assistant (no Transovo Call Control before first audio)
 *
 * Call Control remains for softphone / IVR / outbound / AMD — not for normal
 * inbound AI pickup.
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import * as ai from "@/lib/voice/telnyx/ai-client";
import {
  isLatencyOptimizedProfile,
  type LatencyProfileId,
} from "@/lib/voice/latency-profiles";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { shouldUseOpenAiRealtimeMediaBridge } from "@/lib/voice/telnyx/openai-realtime-bridge/flags";

/** TeXML apps use status_callback (not Call Control webhook_event_url). */
function texmlStatusCallbackBody() {
  const urls = getTelnyxWebhookUrls();
  return {
    status_callback: urls.texmlStatus,
    status_callback_method: "post" as const,
  };
}

export type InboundRoutingMode = "texml_direct" | "call_control";

/** Voice V3 PSTN requires Telnyx Call Control → SIP transfer; never TeXML-direct assistant. */
export function isVoiceV3AppointmentReceptionistConfig(
  config: VoiceAgentConfig | null | undefined,
): boolean {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.capabilityPack === "appointment_receptionist";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Explicit opt-out via callHandling.inboundRoutingMode === "call_control". */
export function getInboundRoutingMode(
  config: VoiceAgentConfig | null | undefined,
): InboundRoutingMode {
  if (isVoiceV3AppointmentReceptionistConfig(config)) {
    return "call_control";
  }
  // OpenAI Realtime media bridge requires Call Control answer + streaming_start — never TeXML-direct assistant.
  if (shouldUseOpenAiRealtimeMediaBridge(config)) {
    return "call_control";
  }
  const raw = String(
    (config?.callHandling as { inboundRoutingMode?: string } | undefined)
      ?.inboundRoutingMode || "",
  )
    .trim()
    .toLowerCase();
  if (raw === "call_control" || raw === "call-control" || raw === "cc") {
    return "call_control";
  }
  if (raw === "texml_direct" || raw === "texml" || raw === "direct") {
    return "texml_direct";
  }
  // Latency-optimized (Flux) profiles use TeXML direct.
  // New agents default to flux_b_balanced + explicit inboundRoutingMode.
  if (isLatencyOptimizedProfile(config?.voiceTiming?.activeProfile)) {
    return "texml_direct";
  }
  // Missing / legacy_cascade / unknown → Call Control (no silent migrate).
  return "call_control";
}

export function usesTexmlDirectInbound(
  config: VoiceAgentConfig | null | undefined,
): boolean {
  return getInboundRoutingMode(config) === "texml_direct";
}

/**
 * Point a DID at a Telnyx assistant via TeXML (bypasses Transovo Call Control).
 */
/**
 * Point a DID at the Transovo Call Control application (inbound webhooks → bridge / assistant start).
 */
export async function routePhoneToCallControlConnection(input: {
  e164: string;
  providerNumberId?: string | null;
  connectionId?: string | null;
}): Promise<{
  e164: string;
  connectionId: string;
  providerNumberId: string;
  liveConnectionId: string | null;
  matched: boolean;
  path: string;
}> {
  const e164 = String(input.e164 || "").trim();
  if (!e164) throw new Error("e164 required for Call Control route");

  const { resolveVoiceConnectionId } = await import("@/lib/phone/telnyx-voice-connection");
  let connectionId =
    String(input.connectionId || "").trim() ||
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    "";
  if (!connectionId) {
    connectionId = await resolveVoiceConnectionId();
  }
  if (!connectionId) {
    throw new Error("TELNYX_CONNECTION_ID required to route inbound to Call Control");
  }

  let providerNumberId = String(input.providerNumberId || "").trim();
  if (!providerNumberId) {
    const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/phone_numbers",
      { query: { "filter[phone_number]": e164, "page[size]": 5 } },
    );
    const rows = Array.isArray(listed.data) ? listed.data : [];
    providerNumberId = String(rows[0]?.id || "");
  }
  if (!providerNumberId) {
    throw new Error(`Phone ${e164} missing providerNumberId`);
  }

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });

  const phoneVerify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId =
    String(
      (asRecord(phoneVerify.data) || asRecord(phoneVerify) || {}).connection_id || "",
    ) || null;
  const matched = liveConnectionId === connectionId;

  return {
    e164,
    connectionId,
    providerNumberId,
    liveConnectionId,
    matched,
    path: `${e164} → Call Control ${connectionId} (Transovo inbound webhooks)`,
  };
}

export async function routePhoneToTexmlAssistant(input: {
  e164: string;
  assistantId: string;
  providerNumberId?: string | null;
  preferredTexmlAppId?: string | null;
}): Promise<{
  e164: string;
  assistantId: string;
  texmlAppId: string;
  providerNumberId: string;
  liveConnectionId: string | null;
  voiceUrl: string;
  matched: boolean;
  path: string;
}> {
  const assistantId = String(input.assistantId || "").trim();
  const e164 = String(input.e164 || "").trim();
  if (!assistantId) throw new Error("assistantId required for TeXML direct route");
  if (!e164) throw new Error("e164 required for TeXML direct route");

  let providerNumberId = String(input.providerNumberId || "").trim();
  if (!providerNumberId) {
    const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/phone_numbers",
      { query: { "filter[phone_number]": e164, "page[size]": 5 } },
    );
    const rows = Array.isArray(listed.data) ? listed.data : [];
    providerNumberId = String(rows[0]?.id || "");
  }
  if (!providerNumberId) {
    throw new Error(`Phone ${e164} missing providerNumberId`);
  }

  const voiceUrl = `https://api.telnyx.com/v2/ai/assistants/${assistantId}/call`;
  const preferred = String(input.preferredTexmlAppId || "").trim();
  let texmlAppId = preferred;
  let voiceUrlLive = "";

  if (preferred) {
    try {
      await telnyxRequest(
        `/texml_applications/${encodeURIComponent(preferred)}`,
        {
          method: "PATCH",
          body: {
            ai_assistant_id: assistantId,
            voice_url: voiceUrl,
            voice_method: "POST",
            active: true,
            ...texmlStatusCallbackBody(),
          },
        },
      );
      const texmlLive = await telnyxRequest<{ data?: Record<string, unknown> }>(
        `/texml_applications/${encodeURIComponent(preferred)}`,
      ).catch(() => null);
      const data = asRecord(texmlLive?.data) || asRecord(texmlLive) || {};
      voiceUrlLive = String(data.voice_url || "");
      if (voiceUrlLive.includes(assistantId)) {
        texmlAppId = preferred;
      } else {
        voiceUrlLive = "";
      }
    } catch {
      voiceUrlLive = "";
    }
  }

  if (!voiceUrlLive.includes(assistantId)) {
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const texmlRes = await telnyxRequest<{ data?: Record<string, unknown> }>(
      "/texml_applications",
      {
        method: "POST",
        body: {
          friendly_name: `AI Direct ${assistantId.slice(-8)} ${stamp}`.slice(
            0,
            60,
          ),
          active: true,
          ai_assistant_id: assistantId,
          voice_url: voiceUrl,
          voice_method: "POST",
          ...texmlStatusCallbackBody(),
        },
      },
    );
    const created = asRecord(texmlRes.data) || asRecord(texmlRes) || {};
    texmlAppId = String(created.id || "");
    if (!texmlAppId) {
      throw new Error(
        `TeXML create returned no id: ${JSON.stringify(texmlRes).slice(0, 500)}`,
      );
    }
    voiceUrlLive = String(created.voice_url || voiceUrl);
  }

  await ai
    .updateAssistant(assistantId, {
      telephony_settings: {
        default_texml_app_id: texmlAppId,
      },
    })
    .catch(() => undefined);

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: texmlAppId },
  });

  const phoneVerify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId =
    String(
      (asRecord(phoneVerify.data) || asRecord(phoneVerify) || {})
        .connection_id || "",
    ) || null;

  const matched =
    voiceUrlLive.includes(assistantId) && liveConnectionId === texmlAppId;

  return {
    e164,
    assistantId,
    texmlAppId,
    providerNumberId,
    liveConnectionId,
    voiceUrl: voiceUrlLive || voiceUrl,
    matched,
    path: `${e164} → TeXML ${texmlAppId} → assistant ${assistantId} (direct; Call Control bypassed)`,
  };
}

/** Ensure config carries the product-default Flux latency profile when missing. */
export function ensureDefaultLatencyProfile(
  config: VoiceAgentConfig,
  defaultProfileId: LatencyProfileId = "flux_b_balanced",
): VoiceAgentConfig {
  if (config.voiceTiming?.activeProfile) return config;
  return {
    ...config,
    voiceTiming: {
      ...(config.voiceTiming || {}),
      activeProfile: defaultProfileId,
    },
    callHandling: {
      ...(config.callHandling || {}),
      inboundRoutingMode: "texml_direct",
      startupGreeting: {
        ...((config.callHandling as { startupGreeting?: object } | undefined)
          ?.startupGreeting || {}),
        enabled: false,
      },
    },
  };
}

/** True when the ACTIVE agent for a workspace DID uses TeXML direct inbound. */
export async function workspaceNumberUsesTexmlDirect(input: {
  workspaceId: string;
  phoneNumberId: string;
}): Promise<boolean> {
  const { getPrisma } = await import("@/lib/db");
  const { parseVoiceAgentConfig } = await import("@/lib/voice/types");
  const prisma = getPrisma();
  const agent =
    (await prisma.voiceAgent.findFirst({
      where: {
        workspaceId: input.workspaceId,
        phoneNumberId: input.phoneNumberId,
        status: "ACTIVE",
      },
      select: { draftConfig: true, publishedVersionId: true },
    })) ||
    (await prisma.voiceAgent.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: "ACTIVE",
        phoneAssignments: {
          some: {
            phoneNumberId: input.phoneNumberId,
            inboundEnabled: true,
          },
        },
      },
      select: { draftConfig: true, publishedVersionId: true },
    }));
  if (!agent) return false;
  let config = parseVoiceAgentConfig(agent.draftConfig);
  if (agent.publishedVersionId) {
    const ver = await prisma.voiceAgentVersion.findUnique({
      where: { id: agent.publishedVersionId },
      select: { config: true },
    });
    if (ver?.config) config = parseVoiceAgentConfig(ver.config);
  }
  return usesTexmlDirectInbound(config);
}
