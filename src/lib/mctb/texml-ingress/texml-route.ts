import "server-only";

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxWebhookUrls } from "@/lib/messaging/telnyx/config";
import {
  MCTB_TEXML_ROUTING_MODE,
  MCTB_TEXML_ROUTING_OWNER,
  MCTB_TEXML_DEFAULT_APP_ID,
} from "./constants";
import { invalidateMctbTexmlIngressCache } from "./config-cache";
import { preflightTexmlVoiceUrl } from "./preflight";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function texmlStatusCallbackBody() {
  const urls = getTelnyxWebhookUrls();
  return {
    status_callback: urls.texmlStatus,
    status_callback_method: "POST" as const,
  };
}

export function mctbTexmlEntryVoiceUrl(): string {
  return getTelnyxWebhookUrls().mctbEntry;
}

export async function ensureMctbTexmlApplicationAtVoiceUrl(input: {
  voiceUrl: string;
  friendlyName: string;
  preferredAppId?: string | null;
}): Promise<string> {
  const voiceUrl = input.voiceUrl.replace(/\/$/, "");
  const preflight = await preflightTexmlVoiceUrl(voiceUrl);
  if (!preflight.ok) {
    throw new Error(
      `TeXML preflight failed (${preflight.status}): ${preflight.error} — deploy route before pointing Telnyx. url=${voiceUrl} body=${preflight.bodyPreview.slice(0, 120)}`,
    );
  }

  const preferred = input.preferredAppId?.trim() || null;

  const patchBody: Record<string, unknown> = {
    voice_url: voiceUrl,
    voice_method: "POST",
    active: true,
    ...texmlStatusCallbackBody(),
  };
  if (input.friendlyName.trim()) {
    patchBody.friendly_name = input.friendlyName.trim();
  }

  if (preferred) {
    try {
      await telnyxRequest(`/texml_applications/${encodeURIComponent(preferred)}`, {
        method: "PATCH",
        body: patchBody,
      });
      return preferred;
    } catch (patchErr) {
      try {
        const existing = await telnyxRequest<{ data?: Record<string, unknown> }>(
          `/texml_applications/${encodeURIComponent(preferred)}`,
        );
        const row = asRecord(existing.data) || asRecord(existing);
        if (row?.id) return String(row.id);
      } catch {
        // fall through
      }
      if (!input.friendlyName.trim()) {
        throw patchErr;
      }
    }
  }

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/texml_applications",
    { query: { "page[size]": 50 } },
  );
  const rows = Array.isArray(listed.data) ? listed.data : [];
  const existing = rows.find(
    (row) => String(row.voice_url || "").replace(/\/$/, "") === voiceUrl,
  );
  if (existing?.id) return String(existing.id);

  const created = await telnyxRequest<{ data?: Record<string, unknown> }>("/texml_applications", {
    method: "POST",
    body: {
      friendly_name: input.friendlyName.trim() || "MCTB TeXML",
      voice_url: voiceUrl,
      voice_method: "POST",
      active: true,
      ...texmlStatusCallbackBody(),
    },
  });
  const app = asRecord(created.data) || asRecord(created) || {};
  const id = String(app.id || "");
  if (!id) throw new Error("Failed to create MCTB TeXML application");
  return id;
}

export async function routePhoneToTexmlApp(input: {
  e164: string;
  providerNumberId: string;
  texmlAppId: string;
}): Promise<void> {
  await telnyxRequest(`/phone_numbers/${encodeURIComponent(input.providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: input.texmlAppId },
  });
  invalidateMctbTexmlIngressCache(input.e164);
}

export async function ensureMctbTexmlApplication(input?: {
  friendlyName?: string;
  preferredAppId?: string | null;
}): Promise<string> {
  return ensureMctbTexmlApplicationAtVoiceUrl({
    voiceUrl: mctbTexmlEntryVoiceUrl(),
    friendlyName: input?.friendlyName || "MCTB TeXML Ingress",
    preferredAppId:
      input?.preferredAppId?.trim() ||
      process.env.MCTB_TEXML_APP_ID?.trim() ||
      MCTB_TEXML_DEFAULT_APP_ID,
  });
}

export async function routePhoneToMctbTexmlIngress(input: {
  e164: string;
  providerNumberId: string;
  friendlyName?: string;
  preferredTexmlAppId?: string | null;
}): Promise<{
  e164: string;
  texmlAppId: string;
  voiceUrl: string;
  liveConnectionId: string | null;
  previousConnectionId: string | null;
  matched: boolean;
  path: string;
}> {
  const texmlAppId = await ensureMctbTexmlApplication({
    friendlyName: input.friendlyName,
    preferredAppId: input.preferredTexmlAppId,
  });
  const voiceUrl = mctbTexmlEntryVoiceUrl();

  const before = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(input.providerNumberId)}`,
  );
  const previousConnectionId = String(
    (asRecord(before.data) || asRecord(before) || {}).connection_id || "",
  );

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(input.providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: texmlAppId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(input.providerNumberId)}`,
  );
  const liveConnectionId = String((asRecord(verify.data) || asRecord(verify) || {}).connection_id || "");
  const matched = liveConnectionId === texmlAppId;

  invalidateMctbTexmlIngressCache(input.e164);

  return {
    e164: input.e164,
    texmlAppId,
    voiceUrl,
    liveConnectionId: liveConnectionId || null,
    previousConnectionId: previousConnectionId || null,
    matched,
    path: matched
      ? `${input.e164} → TeXML ${texmlAppId} → MCTB ingress (Call Control bypassed)`
      : `${input.e164} → TeXML route mismatch (expected ${texmlAppId}, live ${liveConnectionId || "none"})`,
  };
}

export function isMctbTexmlIngressConnection(connectionId: string | null | undefined): boolean {
  if (!connectionId) return false;
  const ids = [
    process.env.MCTB_TEXML_APP_ID?.trim(),
    process.env.MCTB_TEXML_PRESS1_APP_ID?.trim(),
    process.env.MCTB_TEXML_VOICEMAIL_APP_ID?.trim(),
    MCTB_TEXML_DEFAULT_APP_ID,
  ].filter(Boolean);
  return ids.includes(connectionId);
}

export async function verifyMctbTexmlIngressRoute(input: {
  e164: string;
  providerNumberId: string;
  /** When set (Save-time mode routing), verify DID points at dedicated handler app. */
  expectedTexmlAppId?: string | null;
  expectedVoiceUrl?: string | null;
}): Promise<{
  ok: boolean;
  routingMode: string | null;
  texmlAppId: string | null;
  liveConnectionId: string | null;
  voiceUrl: string;
  failReason?: string;
}> {
  const voiceUrl = input.expectedVoiceUrl?.trim() || mctbTexmlEntryVoiceUrl();
  let texmlAppId: string | null = input.expectedTexmlAppId?.trim() || null;
  if (!texmlAppId) {
    try {
      texmlAppId = await ensureMctbTexmlApplication();
    } catch (err) {
    return {
      ok: false,
      routingMode: null,
      texmlAppId: null,
      liveConnectionId: null,
      voiceUrl,
      failReason: err instanceof Error ? err.message : String(err),
    };
    }
  }

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(input.providerNumberId)}`,
  );
  const liveConnectionId = String((asRecord(verify.data) || asRecord(verify) || {}).connection_id || "");
  const connectionName = String((asRecord(verify.data) || asRecord(verify) || {}).connection_name || "");

  const blockedPatterns = ["fqdn", "livekit", "sip", "assistant", "ai direct"];
  const nameLower = connectionName.toLowerCase();
  for (const pat of blockedPatterns) {
    if (nameLower.includes(pat) && liveConnectionId !== texmlAppId) {
      return {
        ok: false,
        routingMode: null,
        texmlAppId,
        liveConnectionId,
        voiceUrl,
        failReason: `DID on wrong connection type: ${connectionName} (${liveConnectionId})`,
      };
    }
  }

  const ok = liveConnectionId === texmlAppId;
  return {
    ok,
    routingMode: ok ? MCTB_TEXML_ROUTING_MODE : null,
    texmlAppId,
    liveConnectionId: liveConnectionId || null,
    voiceUrl,
    failReason: ok ? undefined : `Expected TeXML ${texmlAppId}, live ${liveConnectionId || "(none)"}`,
  };
}

/** Restore a DID off the MCTB TeXML app (e.g. number switch or MCTB disable). */
export async function unroutePhoneFromMctbTexmlIngress(input: {
  e164?: string | null;
  providerNumberId: string;
  restoreConnectionId: string;
}): Promise<{ ok: boolean; liveConnectionId: string | null }> {
  const restoreConnectionId = input.restoreConnectionId.trim();
  if (!restoreConnectionId) {
    return { ok: false, liveConnectionId: null };
  }

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(input.providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: restoreConnectionId },
  });

  const verify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(input.providerNumberId)}`,
  );
  const liveConnectionId = String((asRecord(verify.data) || asRecord(verify) || {}).connection_id || "");

  if (input.e164) invalidateMctbTexmlIngressCache(input.e164);

  return { ok: liveConnectionId === restoreConnectionId, liveConnectionId: liveConnectionId || null };
}

export { MCTB_TEXML_ROUTING_MODE, MCTB_TEXML_ROUTING_OWNER };
