import "server-only";

import { createHmac, randomBytes } from "crypto";
import { updateWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import { shouldImportFromConnection } from "@/lib/calendar/eligibility";
import { enqueueCalendarConnectionSync, syncCalendarProviderEventById } from "@/lib/calendar/import-sync";
import {
  getValidAccessToken,
  microsoftGraphFetch,
  resolveImportCalendarIds,
  resolveWriteCalendarId,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import {
  MICROSOFT_GRAPH_V1,
  OUTLOOK_EVENTS_SUBSCRIPTION_RESOURCE,
  outlookEventSubscriptionExpiration,
} from "@/lib/microsoft/graph-helpers";
import { getPrisma } from "@/lib/db";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function webhookSecret() {
  return process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-dev-oauth";
}

export function signCalendarWebhookState(connectionId: string, workspaceId: string) {
  const payload = `${connectionId}:${workspaceId}`;
  const sig = createHmac("sha256", webhookSecret()).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function parseCalendarWebhookState(state: string): { connectionId: string; workspaceId: string } | null {
  const parts = state.split(":");
  if (parts.length < 3) return null;
  const connectionId = parts[0];
  const workspaceId = parts[1];
  const sig = parts.slice(2).join(":");
  const payload = `${connectionId}:${workspaceId}`;
  const expected = createHmac("sha256", webhookSecret()).update(payload).digest("hex");
  if (sig !== expected) return null;
  return { connectionId, workspaceId };
}

export async function ensureMicrosoftCalendarSubscription(workspaceId: string, connectionId: string) {
  const conn = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "microsoft" },
  });
  if (!conn) return null;

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(connectionId, "microsoft", config);
  if (!token) return null;

  const existing = config.microsoftSubscription;
  if (existing?.expiresAt && new Date(existing.expiresAt).getTime() > Date.now() + 3600_000) {
    return existing;
  }

  const expirationDateTime = outlookEventSubscriptionExpiration();
  const clientState = signCalendarWebhookState(connectionId, workspaceId);

  if (existing?.id) {
    const renewRes = await microsoftGraphFetch(
      connectionId,
      config,
      `${MICROSOFT_GRAPH_V1}/subscriptions/${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expirationDateTime }),
      },
    );
    if (renewRes.ok) {
      const renewed = await renewRes.json();
      const subscription = {
        id: String(renewed.id || existing.id),
        expiresAt: String(renewed.expirationDateTime || expirationDateTime),
        resource: String(renewed.resource || existing.resource || OUTLOOK_EVENTS_SUBSCRIPTION_RESOURCE),
      };
      await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
        config: { ...config, microsoftSubscription: subscription },
      });
      return subscription;
    }
    if (renewRes.status !== 404) {
      const err = await renewRes.text();
      console.warn("[calendar] microsoft subscription renew failed", connectionId, err);
    }
  }

  const res = await microsoftGraphFetch(connectionId, config, `${MICROSOFT_GRAPH_V1}/subscriptions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType: "created,updated,deleted",
      notificationUrl: `${appUrl()}/api/integrations/calendars/webhooks/microsoft`,
      resource: OUTLOOK_EVENTS_SUBSCRIPTION_RESOURCE,
      expirationDateTime,
      clientState,
      latestSupportedTlsVersion: "v1_2",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn("[calendar] microsoft subscription failed", connectionId, err);
    return null;
  }

  const json = await res.json();
  const subscription = {
    id: String(json.id),
    expiresAt: String(json.expirationDateTime),
    resource: String(json.resource || OUTLOOK_EVENTS_SUBSCRIPTION_RESOURCE),
  };

  await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
    config: { ...config, microsoftSubscription: subscription },
  });

  return subscription;
}

export async function ensureGoogleCalendarWatch(
  workspaceId: string,
  connectionId: string,
  calendarId?: string,
) {
  const conn = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "google" },
  });
  if (!conn) return null;

  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(connectionId, "google", config);
  if (!token) return null;

  const calId = calendarId || resolveWriteCalendarId(config);
  const channels = config.googleWatchChannels || [];
  const existing = channels.find((c) => c.calendarId === calId);
  if (existing?.expiresAt && new Date(existing.expiresAt).getTime() > Date.now() + 3600_000) {
    return existing;
  }

  const channelId = randomBytes(16).toString("hex");
  const tokenState = signCalendarWebhookState(connectionId, workspaceId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: `${appUrl()}/api/integrations/calendars/webhooks/google`,
        token: tokenState,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn("[calendar] google watch failed", connectionId, calId, err);
    return null;
  }

  const json = await res.json();
  const channel = {
    calendarId: calId,
    channelId: String(json.id || channelId),
    resourceId: String(json.resourceId),
    expiresAt: new Date(Number(json.expiration)).toISOString(),
  };

  const nextChannels = [...channels.filter((c) => c.calendarId !== calId), channel];
  await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
    config: { ...config, googleWatchChannels: nextChannels },
  });

  return channel;
}

export async function registerCalendarPushNotifications(workspaceId: string, connectionId: string) {
  const conn = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId },
  });
  if (!conn) return;
  const config = (conn.config || {}) as CalendarConfig;
  if (!shouldImportFromConnection(config)) return;

  if (conn.provider === "microsoft") {
    await ensureMicrosoftCalendarSubscription(workspaceId, connectionId);
  } else if (conn.provider === "google") {
    for (const calId of config.importCalendarIds || []) {
      await ensureGoogleCalendarWatch(workspaceId, connectionId, calId);
    }
  }
}

function parseMicrosoftWebhookEventId(note: {
  resource?: string;
  resourceData?: { id?: string };
}): string | null {
  if (note.resourceData?.id) return note.resourceData.id;
  const resource = note.resource || "";
  const match = resource.match(/\/events\/([^/?]+)/i);
  return match?.[1] || null;
}

export async function handleMicrosoftCalendarWebhook(notifications: Array<{
  subscriptionId?: string;
  clientState?: string;
  changeType?: string;
  resource?: string;
  resourceData?: { id?: string };
}>) {
  for (const note of notifications) {
    const parsed = note.clientState ? parseCalendarWebhookState(note.clientState) : null;
    if (!parsed) continue;

    const conn = await getPrisma().voiceCalendarConnection.findFirst({
      where: { id: parsed.connectionId, workspaceId: parsed.workspaceId },
    });
    if (!conn) continue;
    const config = (conn.config || {}) as CalendarConfig;
    if (!shouldImportFromConnection(config)) continue;

    const providerEventId = parseMicrosoftWebhookEventId(note);
    const idempotencyKey = `ms-cal:${note.subscriptionId || "sub"}:${providerEventId || "none"}:${note.changeType || "change"}`;

    try {
      await recordWebhookOnce("microsoft", idempotencyKey, parsed.workspaceId, note);
    } catch {
      continue;
    }

    if (providerEventId) {
      await syncCalendarProviderEventById({
        workspaceId: parsed.workspaceId,
        connectionId: parsed.connectionId,
        provider: "microsoft",
        eventId: providerEventId,
      });
    } else {
      await enqueueCalendarConnectionSync(parsed.workspaceId, parsed.connectionId, true);
    }
  }
}

export async function handleGoogleCalendarWebhook(input: {
  channelId?: string;
  resourceId?: string;
  resourceState?: string;
  channelToken?: string;
}) {
  const parsed = input.channelToken ? parseCalendarWebhookState(input.channelToken) : null;
  if (!parsed) return;

  // Google sends a `sync` message when the watch channel is first created.
  if (input.resourceState === "sync") return;

  const idempotencyKey = `google-cal:${input.channelId}:${input.resourceId}:${input.resourceState}`;
  try {
    await recordWebhookOnce("google", idempotencyKey, parsed.workspaceId, input);
  } catch {
    return;
  }

  await enqueueCalendarConnectionSync(parsed.workspaceId, parsed.connectionId, true);
}

async function recordWebhookOnce(
  provider: string,
  providerEventId: string,
  workspaceId: string,
  payload: unknown,
) {
  const prisma = getPrisma();
  try {
    await prisma.providerWebhookEvent.create({
      data: {
        workspaceId,
        provider,
        eventType: "calendar_change",
        providerEventId,
        payload: payload as object,
        status: "received",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(message)) {
      throw new Error("duplicate_webhook");
    }
    throw err;
  }
}

export async function renewExpiringCalendarSubscriptions() {
  const prisma = getPrisma();
  const connections = await prisma.voiceCalendarConnection.findMany({
    where: { provider: { in: ["google", "microsoft"] }, status: "connected" },
    take: 200,
  });

  for (const conn of connections) {
    const config = (conn.config || {}) as CalendarConfig;
    if (!shouldImportFromConnection(config)) continue;
    try {
      if (conn.provider === "microsoft") {
        const exp = config.microsoftSubscription?.expiresAt;
        if (!exp || new Date(exp).getTime() < Date.now() + 6 * 3600_000) {
          await ensureMicrosoftCalendarSubscription(conn.workspaceId, conn.id);
        }
      } else if (conn.provider === "google") {
        for (const calId of resolveImportCalendarIds(config)) {
          const channel = (config.googleWatchChannels || []).find((c) => c.calendarId === calId);
          if (!channel?.expiresAt || new Date(channel.expiresAt).getTime() < Date.now() + 6 * 3600_000) {
            await ensureGoogleCalendarWatch(conn.workspaceId, conn.id, calId);
          }
        }
      }
    } catch (err) {
      console.warn("[calendar] subscription renew failed", conn.id, err);
    }
  }
}
