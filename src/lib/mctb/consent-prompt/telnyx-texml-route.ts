import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { publicPlaybackUrl } from "@/lib/smart-routing/media-service";

const DEFAULT_CONSENT_AUDIO_ASSET_ID = "cmt3o8tyd1o5r0o4k3e4n5v2l";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function mctb571ConsentPlaybackUrl(): string {
  const assetId =
    process.env.MCTB_PLATFORM_CONSENT_AUDIO_ASSET_ID?.trim() || DEFAULT_CONSENT_AUDIO_ASSET_ID;
  return publicPlaybackUrl(assetId);
}

export function mctb571ConsentTexmlVoiceUrl(): string {
  const urls = getTelnyxWebhookUrls();
  return urls.mctbConsentTexml;
}

function texmlStatusCallbackBody() {
  const urls = getTelnyxWebhookUrls();
  return {
    status_callback: urls.texmlStatus,
    status_callback_method: "POST" as const,
  };
}

/** Ensure TeXML app exists for MCTB Press-1 on platform 571 (answers at Telnyx edge). */
export async function ensureMctb571ConsentTexmlApplication(): Promise<string> {
  const voiceUrl = mctb571ConsentTexmlVoiceUrl();
  const preferred = process.env.MCTB_PLATFORM_CONSENT_TEXML_APP_ID?.trim() || "";

  if (preferred) {
    try {
      await telnyxRequest(`/texml_applications/${encodeURIComponent(preferred)}`, {
        method: "PATCH",
        body: {
          friendly_name: "MCTB Platform 571 Consent",
          voice_url: voiceUrl,
          voice_method: "POST",
          active: true,
          // Carrier forwards (AT&T Diversion) cancel in ~1–2s — must not wait on slow voice_url.
          first_command_timeout: true,
          first_command_timeout_secs: 5,
          anchorsite_override:
            process.env.MCTB_TEXML_ANCHORSITE?.trim() || "Ashburn, VA",
          ...texmlStatusCallbackBody(),
        },
      });
      return preferred;
    } catch {
      // fall through to create
    }
  }

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/texml_applications",
    { query: { "page[size]": 50 } },
  );
  const rows = Array.isArray(listed.data) ? listed.data : [];
  const existing = rows.find(
    (row) => String(row.voice_url || "").replace(/\/$/, "") === voiceUrl.replace(/\/$/, ""),
  );
  if (existing?.id) return String(existing.id);

  const created = await telnyxRequest<{ data?: Record<string, unknown> }>("/texml_applications", {
    method: "POST",
    body: {
      friendly_name: "MCTB Platform 571 Consent",
      voice_url: voiceUrl,
      voice_method: "POST",
      active: true,
      first_command_timeout: true,
      first_command_timeout_secs: 5,
      anchorsite_override:
        process.env.MCTB_TEXML_ANCHORSITE?.trim() || "Ashburn, VA",
      ...texmlStatusCallbackBody(),
    },
  });
  const app = asRecord(created.data) || asRecord(created) || {};
  const id = String(app.id || "");
  if (!id) throw new Error("Failed to create MCTB TeXML application");
  return id;
}

/** Route platform 571 inbound to TeXML (instant answer/play — required for carrier forwards). */
export async function route571ToMctbConsentTexml(providerNumberId: string): Promise<{
  texmlAppId: string;
  voiceUrl: string;
}> {
  const texmlAppId = await ensureMctb571ConsentTexmlApplication();
  const voiceUrl = mctb571ConsentTexmlVoiceUrl();

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: texmlAppId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const live = String((asRecord(verify.data) || asRecord(verify) || {}).connection_id || "");
  if (live !== texmlAppId) {
    throw new Error(
      `571 TeXML route mismatch: expected ${texmlAppId}, live connection ${live || "(none)"}`,
    );
  }

  return { texmlAppId, voiceUrl };
}

export function isPlatform571E164(e164: string): boolean {
  return e164.replace(/\D/g, "").endsWith(MCTB_PLATFORM_DEMO_E164.replace(/\D/g, ""));
}

export const MCTB_571_CONSENT_TEXML_APP_ID = "3031854672919922436";

export function isMctb571ConsentTexmlConnection(connectionId: string | null | undefined): boolean {
  if (!connectionId) return false;
  const preferred = process.env.MCTB_PLATFORM_CONSENT_TEXML_APP_ID?.trim();
  if (preferred) return connectionId === preferred;
  return connectionId === MCTB_571_CONSENT_TEXML_APP_ID;
}

export async function verify571MctbConsentTexmlRoute(providerNumberId: string): Promise<{
  ok: boolean;
  texmlAppId: string | null;
  voiceUrl: string;
  liveConnectionId: string | null;
  detail: string;
}> {
  const voiceUrl = mctb571ConsentTexmlVoiceUrl();
  let texmlAppId: string | null = null;
  try {
    texmlAppId = await ensureMctb571ConsentTexmlApplication();
  } catch (err) {
    return {
      ok: false,
      texmlAppId: null,
      voiceUrl,
      liveConnectionId: null,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId = String((asRecord(verify.data) || asRecord(verify) || {}).connection_id || "");
  const ok = Boolean(texmlAppId && liveConnectionId === texmlAppId);
  return {
    ok,
    texmlAppId,
    voiceUrl,
    liveConnectionId: liveConnectionId || null,
    detail: ok
      ? `571 on TeXML app ${texmlAppId}`
      : `Expected TeXML ${texmlAppId}, live connection ${liveConnectionId || "(none)"}`,
  };
}
