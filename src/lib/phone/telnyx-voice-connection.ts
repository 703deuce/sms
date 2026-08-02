/**
 * Resolve / ensure the platform Telnyx Call Control Application used for
 * inbound+outbound voice (softphone bridge, queues, AI). Separate from
 * TELNYX_TELEPHONY_CREDENTIAL_ID (WebRTC softphone login).
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  getTelnyxApiKey,
  getTelnyxWebhookUrls,
} from "@/lib/messaging/telnyx/config";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function isCredentialLikeConnection(
  app: Record<string, unknown> | null | undefined,
): boolean {
  if (!app) return false;
  const source = String(app._source || "");
  const connType = String(
    app.connection_type || app.record_type || source || "",
  );
  if (source === "connections") return true;
  return /credential|ip_connection|fqdn|sip_connection/i.test(connType);
}

export function isCallControlApplication(
  app: Record<string, unknown> | null | undefined,
): boolean {
  if (!app || isCredentialLikeConnection(app)) return false;
  const rt = String(app.record_type || "");
  return (
    rt === "call_control_application" ||
    Boolean(app.application_name && app.id && !app.connection_type)
  );
}

export async function fetchConnectionOrApp(connectionId: string) {
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/call_control_applications/${encodeURIComponent(connectionId)}`,
    );
    const app = asRecord(res.data);
    if (app) return { ...app, _source: "call_control_applications" as const };
  } catch {
    // fall through
  }
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/connections/${encodeURIComponent(connectionId)}`,
    );
    const conn = asRecord(res.data);
    if (conn) {
      return {
        ...conn,
        application_name:
          conn.application_name ||
          conn.connection_name ||
          conn.name ||
          "connection",
        webhook_event_url: conn.webhook_event_url || conn.webhook_url || "",
        _source: "connections" as const,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function listCallControlApplications(): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<{
      data?: Array<Record<string, unknown>>;
      meta?: { total_pages?: number };
    }>("/call_control_applications", {
      query: { "page[number]": page, "page[size]": 50 },
    });
    const rows = res.data || [];
    for (const row of rows) {
      out.push({ ...row, _source: "call_control_applications" });
    }
    const totalPages = Number(res.meta?.total_pages || 1);
    if (page >= totalPages || rows.length === 0) break;
    page += 1;
    if (page > 10) break;
  }
  return out;
}

/**
 * Find or create the Transovo Voice Call Control Application.
 * Prefer env TELNYX_CONNECTION_ID only when it is already a Call Control app.
 */
export async function ensureVoiceCallControlApplication(input?: {
  webhookUrl?: string;
}): Promise<{
  connectionId: string;
  app: Record<string, unknown>;
  created: boolean;
  updated: boolean;
  envConnectionIsCredential: boolean;
}> {
  if (!getTelnyxApiKey()) {
    throw new Error("TELNYX_API_KEY required");
  }
  const want = (input?.webhookUrl || getTelnyxWebhookUrls().voice).replace(
    /\/$/,
    "",
  );
  const envId = process.env.TELNYX_CONNECTION_ID?.trim() || "";
  let envConnectionIsCredential = false;

  if (envId) {
    const envApp = (await fetchConnectionOrApp(envId)) as Record<
      string,
      unknown
    > | null;
    if (isCallControlApplication(envApp)) {
      const currentUrl = String(envApp?.webhook_event_url || "").replace(
        /\/$/,
        "",
      );
      let app: Record<string, unknown> = envApp || {};
      let updated = false;
      if (
        currentUrl !== want ||
        app.active === false ||
        String(app.webhook_api_version || "") !== "2"
      ) {
        const patched = await telnyxRequest<{ data?: Record<string, unknown> }>(
          `/call_control_applications/${encodeURIComponent(envId)}`,
          {
            method: "PATCH",
            body: {
              application_name:
                String(app.application_name || "").trim() || "Transovo Voice",
              webhook_event_url: want,
              webhook_api_version: "2",
              active: true,
            },
          },
        );
        app = {
          ...(asRecord(patched.data) || app),
          _source: "call_control_applications",
        };
        updated = true;
      }
      return {
        connectionId: envId,
        app,
        created: false,
        updated,
        envConnectionIsCredential: false,
      };
    }
    if (isCredentialLikeConnection(envApp)) {
      envConnectionIsCredential = true;
    }
  }

  const apps = await listCallControlApplications();
  const byWebhook = apps.find(
    (a) => String(a.webhook_event_url || "").replace(/\/$/, "") === want,
  );
  const byName = apps.find((a) =>
    /transovo/i.test(String(a.application_name || "")),
  );
  let app = byWebhook || byName || null;
  let created = false;
  let updated = false;

  if (!app) {
    const createdRes = await telnyxRequest<{ data?: Record<string, unknown> }>(
      "/call_control_applications",
      {
        method: "POST",
        body: {
          application_name: "Transovo Voice",
          webhook_event_url: want,
          webhook_api_version: "2",
          active: true,
          first_command_timeout: true,
          first_command_timeout_secs: 30,
        },
      },
    );
    app = asRecord(createdRes.data);
    if (!app?.id) throw new Error("Failed to create Call Control Application");
    app = { ...app, _source: "call_control_applications" };
    created = true;
  } else {
    const id = String(app.id);
    const currentUrl = String(app.webhook_event_url || "").replace(/\/$/, "");
    if (
      currentUrl !== want ||
      app.active === false ||
      String(app.webhook_api_version || "") !== "2"
    ) {
      const patched = await telnyxRequest<{ data?: Record<string, unknown> }>(
        `/call_control_applications/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: {
            application_name:
              String(app.application_name || "").trim() || "Transovo Voice",
            webhook_event_url: want,
            webhook_api_version: "2",
            active: true,
          },
        },
      );
      app = {
        ...(asRecord(patched.data) || app),
        _source: "call_control_applications",
      };
      updated = true;
    }
  }

  return {
    connectionId: String(app.id),
    app,
    created,
    updated,
    envConnectionIsCredential,
  };
}

/** Connection id to use for number attach / dials (never a credential softphone id). */
export async function resolveVoiceConnectionId(): Promise<string> {
  const { connectionId } = await ensureVoiceCallControlApplication();
  return connectionId;
}
