import type { ExternalIntegrationAdapter } from "../framework/adapter";
import { integrationFetch } from "../framework/http";
import { makeEventIdempotencyKey } from "../framework/events";
import type {
  AdapterContext,
  CapabilityDefinition,
  NormalizedAppointment,
  NormalizedEvent,
} from "../framework/types";

const caps: CapabilityDefinition = {
  objects: {
    appointment: "read_only",
    contact: "read_only",
    form: "subscription_dependent",
  },
  events: {
    "appointment.scheduled": "subscription_dependent",
    "appointment.canceled": "subscription_dependent",
    "appointment.rescheduled": "subscription_dependent",
    "contact.created": "read_only",
  },
  actions: {
    create_scheduling_link: "subscription_dependent",
  },
  webhooks: "subscription_dependent",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function api(path: string, ctx: AdapterContext, init?: RequestInit) {
  return integrationFetch(`https://api.calendly.com${path}`, {
    ...init,
    accessToken: ctx.accessToken,
  });
}

export const calendlyAdapter: ExternalIntegrationAdapter = {
  id: "calendly",
  displayName: "Calendly",
  authKind: "oauth",
  oauth: {
    authorizationUrl: "https://auth.calendly.com/oauth/authorize",
    tokenUrl: "https://auth.calendly.com/oauth/token",
    clientIdEnv: "CALENDLY_CLIENT_ID",
    clientSecretEnv: "CALENDLY_CLIENT_SECRET",
    scopes: [],
    sandboxAuthorizationUrl: "https://auth.calendly.com/oauth/authorize",
    sandboxTokenUrl: "https://auth.calendly.com/oauth/token",
    sandboxClientIdEnv: "CALENDLY_SANDBOX_CLIENT_ID",
    sandboxClientSecretEnv: "CALENDLY_SANDBOX_CLIENT_SECRET",
  },
  capabilities: caps,

  parseTokenResponse(json) {
    const expiresIn = Number(json.expires_in || 0);
    return {
      accessToken: String(json.access_token || ""),
      refreshToken: json.refresh_token ? String(json.refresh_token) : null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      meta: { owner: json.owner || null, organization: json.organization || null },
    };
  },

  async validateConnection(ctx) {
    const me = await api("/users/me", ctx);
    const resource = (me as { resource?: Record<string, unknown> }).resource || {};
    return {
      ok: true,
      accountId: String(resource.uri || resource.uuid || ""),
      accountName: String(resource.name || resource.email || "Calendly user"),
      scopes: [],
      capabilities: ["users", "event_types", "scheduled_events", "webhooks_plan_dependent"],
      details: { email: resource.email, schedulingUrl: resource.scheduling_url },
    };
  },

  async identifyAccount(ctx) {
    const health = await this.validateConnection(ctx);
    return {
      accountId: health.accountId || "",
      accountName: health.accountName || "Calendly",
      details: health.details,
    };
  },

  async listAppointments(ctx, cursor, opts) {
    const me = await api("/users/me", ctx);
    const userUri = String(
      ((me as { resource?: { uri?: string } }).resource || {}).uri || "",
    );
    const params = new URLSearchParams({ user: userUri, count: "50" });
    if (cursor) params.set("page_token", cursor);
    if (opts?.modifiedSince) {
      params.set("min_start_time", opts.modifiedSince.toISOString());
    }
    const data = await api(`/scheduled_events?${params}`, ctx);
    const collection = ((data as { collection?: Record<string, unknown>[] }).collection ||
      []) as Record<string, unknown>[];
    const items: NormalizedAppointment[] = [];
    for (const ev of collection) {
      // Enrich with first invitee when possible
      let inviteeEmail: string | null = null;
      let inviteeName: string | null = null;
      let inviteePhone: string | null = null;
      try {
        const eventId = String(ev.uri || "").split("/").pop() || "";
        if (eventId) {
          const inv = await api(
            `/scheduled_events/${encodeURIComponent(eventId)}/invitees?count=1`,
            ctx,
          );
          const first = ((inv as { collection?: Record<string, unknown>[] }).collection ||
            [])[0];
          if (first) {
            inviteeEmail = (first.email as string) || null;
            inviteeName = (first.name as string) || null;
            const qs =
              (first.questions_and_answers as Array<{ answer?: string; question?: string }>) ||
              [];
            const phoneAns = qs.find((q) => /phone|mobile|cell/i.test(q.question || ""));
            inviteePhone = phoneAns?.answer || (first.text_reminder_number as string) || null;
          }
        }
      } catch {
        // invitee fetch may fail on plan/role — still return event
      }
      items.push({
        id: String(ev.uri || ""),
        title: String(ev.name || "Calendly event"),
        startAt: (ev.start_time as string) || null,
        endAt: (ev.end_time as string) || null,
        status: (ev.status as string) || null,
        location: typeof ev.location === "object" ? JSON.stringify(ev.location) : null,
        inviteeEmail,
        inviteeName,
        inviteePhone,
        eventTypeId: (ev.event_type as string) || null,
        cancelUrl: null,
        rescheduleUrl: null,
        updatedAt: (ev.updated_at as string) || null,
        raw: ev,
      });
    }
    const next =
      ((data as { pagination?: { next_page_token?: string } }).pagination || {})
        .next_page_token || null;
    return { items, nextCursor: next };
  },

  async registerWebhooks(ctx, callbackUrl) {
    const me = await api("/users/me", ctx);
    const org =
      ((me as { resource?: { current_organization?: string } }).resource || {})
        .current_organization || null;
    const user = ((me as { resource?: { uri?: string } }).resource || {}).uri || null;
    const body = {
      url: callbackUrl,
      events: ["invitee.created", "invitee.canceled"],
      organization: org,
      user: org ? undefined : user,
      scope: org ? "organization" : "user",
    };
    try {
      const created = await api("/webhook_subscriptions", ctx, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const uri = String(
        ((created as { resource?: { uri?: string } }).resource || {}).uri || "",
      );
      return { ids: uri ? [uri] : [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Calendly webhook registration failed (plan/role may block webhooks): ${message}`,
      );
    }
  },

  async removeWebhooks(ctx, ids) {
    for (const id of ids || []) {
      const uuid = id.split("/").pop();
      if (!uuid) continue;
      try {
        await api(`/webhook_subscriptions/${uuid}`, ctx, { method: "DELETE" });
      } catch {
        // ignore
      }
    }
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const body = payload as {
      event?: string;
      payload?: Record<string, unknown>;
    };
    const eventName = body.event || "";
    const p = body.payload || {};
    const email = (p.email as string) || null;
    const name = (p.name as string) || null;
    const phone =
      (p.text_reminder_number as string) ||
      (
        (p.questions_and_answers as Array<{ question?: string; answer?: string }>) || []
      ).find((q) => /phone|mobile|cell/i.test(q.question || ""))?.answer ||
      null;
    const externalId = String(p.uri || p.event || `${eventName}:${email}`);
    let eventType: NormalizedEvent["eventType"] = "appointment.scheduled";
    if (eventName.includes("canceled")) eventType = "appointment.canceled";
    if (p.rescheduled || eventName.includes("reschedule")) {
      eventType = "appointment.rescheduled";
    }
    return [
      {
        workspaceId,
        provider: "calendly",
        externalEventId: externalId,
        eventType,
        occurredAt: String(p.created_at || new Date().toISOString()),
        externalObjectType: "appointment",
        externalObjectId: String(p.event || externalId),
        phone,
        email,
        idempotencyKey: makeEventIdempotencyKey("calendly", externalId, eventType),
        payload: {
          name,
          eventType,
          cancelUrl: p.cancel_url,
          rescheduleUrl: p.reschedule_url,
          tracking: p.tracking,
        },
        rawMeta: { calendlyEvent: eventName },
      },
    ];
  },

  async createTestRecord(ctx) {
    // Calendly does not allow creating scheduled events via API for arbitrary invitees easily.
    // Probe: list event types as read verification.
    const me = await api("/users/me", ctx);
    const user = String(((me as { resource?: { uri?: string } }).resource || {}).uri || "");
    const types = await api(`/event_types?user=${encodeURIComponent(user)}&count=1`, ctx);
    const first = ((types as { collection?: { uri?: string; name?: string }[] }).collection ||
      [])[0];
    return {
      objectType: "event_type",
      externalId: String(first?.uri || user),
      label: first?.name || "Transovo Integration Test Appointment (read probe)",
    };
  },

  async readTestRecord(ctx, _objectType, externalId) {
    if (externalId.includes("event_types")) {
      const uuid = externalId.split("/").pop();
      return api(`/event_types/${uuid}`, ctx) as Promise<Record<string, unknown>>;
    }
    return api("/users/me", ctx) as Promise<Record<string, unknown>>;
  },

  async refreshMetadata(ctx) {
    const me = await api("/users/me", ctx);
    const user = String(((me as { resource?: { uri?: string } }).resource || {}).uri || "");
    const types = await api(`/event_types?user=${encodeURIComponent(user)}&count=20`, ctx);
    return {
      user: (me as { resource?: unknown }).resource,
      eventTypes: (types as { collection?: unknown }).collection || [],
    };
  },
};
