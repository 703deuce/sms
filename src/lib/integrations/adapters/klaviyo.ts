import type { ExternalIntegrationAdapter } from "../framework/adapter";
import { integrationFetch } from "../framework/http";
import { makeEventIdempotencyKey } from "../framework/events";
import type {
  AdapterContext,
  CapabilityDefinition,
  NormalizedContact,
  NormalizedEvent,
} from "../framework/types";

const caps: CapabilityDefinition = {
  objects: {
    contact: "read_write",
    audience: "read_write",
    segment: "read_only",
    campaign: "read_only",
    external_event: "write_only",
  },
  events: {
    "profile.updated": "read_write",
    "audience.member_added": "read_write",
    "consent.changed": "read_write",
    "order.created": "scope_dependent",
  },
  actions: {
    upsert_contact: "read_write",
    add_to_list: "read_write",
    remove_from_list: "read_write",
    subscribe_marketing: "read_write",
    unsubscribe_marketing: "read_write",
  },
  webhooks: "scope_dependent",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function klFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  return integrationFetch<T>(`https://a.klaviyo.com/api${path}`, {
    ...init,
    headers: {
      Authorization: `Klaviyo-API-Key ${ctx.accessToken}`,
      revision: "2024-10-15",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
}

export const klaviyoAdapter: ExternalIntegrationAdapter = {
  id: "klaviyo",
  displayName: "Klaviyo",
  authKind: "credentials",
  credentialFields: [
    {
      key: "apiKey",
      label: "Private API key",
      type: "password",
      required: true,
      help: "Use a scoped private key. Never ask for full access when smaller scopes suffice.",
    },
  ],
  capabilities: caps,

  async validateConnection(ctx) {
    const accounts = await klFetch<{
      data?: Array<{ id?: string; attributes?: { contact_information?: { default_sender_name?: string; organization_name?: string } } }>;
    }>(ctx, "/accounts/");
    const account = accounts.data?.[0];
    return {
      ok: true,
      accountId: String(account?.id || "klaviyo"),
      accountName:
        account?.attributes?.contact_information?.organization_name ||
        account?.attributes?.contact_information?.default_sender_name ||
        "Klaviyo",
      capabilities: ["profiles", "lists", "segments", "events", "consent"],
      details: {
        consentNote: "Email and SMS consent are tracked separately — never infer SMS consent from phone alone.",
      },
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return {
      accountId: h.accountId || "",
      accountName: h.accountName || "Klaviyo",
      details: h.details,
    };
  },

  async listContacts(ctx, cursor) {
    const params = new URLSearchParams({ "page[size]": "50" });
    const path = cursor ? cursor : `/profiles/?${params}`;
    const data = await klFetch<{
      data?: Array<Record<string, unknown>>;
      links?: { next?: string | null };
    }>(ctx, path.startsWith("http") ? path.replace("https://a.klaviyo.com/api", "") : path);
    const items: NormalizedContact[] = (data.data || []).map((p) => {
      const attrs = (p.attributes || {}) as Record<string, unknown>;
      return {
        id: String(p.id),
        email: (attrs.email as string) || null,
        phone: (attrs.phone_number as string) || null,
        firstName: (attrs.first_name as string) || null,
        lastName: (attrs.last_name as string) || null,
        customFields: {
          subscriptions: attrs.subscriptions,
          properties: attrs.properties,
        },
        updatedAt: (attrs.updated as string) || null,
        raw: p,
      };
    });
    const nextLink = data.links?.next || null;
    return {
      items,
      nextCursor: nextLink
        ? nextLink.replace("https://a.klaviyo.com/api", "")
        : null,
    };
  },

  async upsertContact(ctx, contact) {
    const attrs: Record<string, unknown> = {
      email: contact.email,
      phone_number: contact.phone || undefined,
      first_name: contact.firstName,
      last_name: contact.lastName,
      properties: contact.customFields || {},
    };
    if (contact.id) {
      await klFetch(ctx, `/profiles/${contact.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          data: { type: "profile", id: contact.id, attributes: attrs },
        }),
      });
      return { externalId: String(contact.id), created: false };
    }
    const data = await klFetch<{ data?: { id?: string } }>(ctx, "/profile-import/", {
      method: "POST",
      body: JSON.stringify({
        data: { type: "profile", attributes: attrs },
      }),
    });
    return { externalId: String(data.data?.id || ""), created: true };
  },

  async listAudiences(ctx, cursor) {
    const path = cursor || "/lists/?page[size]=50";
    const data = await klFetch<{
      data?: Array<Record<string, unknown>>;
      links?: { next?: string | null };
    }>(ctx, path.startsWith("/") ? path : `/lists/?page[size]=50`);
    return {
      items: (data.data || []).map((l) => ({
        id: String(l.id),
        name: String(((l.attributes as { name?: string }) || {}).name || l.id),
        raw: l,
      })),
      nextCursor: data.links?.next
        ? data.links.next.replace("https://a.klaviyo.com/api", "")
        : null,
    };
  },

  async addToList(ctx, externalContactId, listId) {
    await klFetch(ctx, `/lists/${listId}/relationships/profiles/`, {
      method: "POST",
      body: JSON.stringify({
        data: [{ type: "profile", id: externalContactId }],
      }),
    });
  },

  async removeFromList(ctx, externalContactId, listId) {
    await klFetch(ctx, `/lists/${listId}/relationships/profiles/`, {
      method: "DELETE",
      body: JSON.stringify({
        data: [{ type: "profile", id: externalContactId }],
      }),
    });
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as Record<string, unknown>;
    const topic = String(p.topic || p.type || "profile");
    const data = (p.data || p) as Record<string, unknown>;
    const attrs = (data.attributes || data) as Record<string, unknown>;
    const externalId = String(data.id || attrs.id || Date.now());
    let eventType: NormalizedEvent["eventType"] = "profile.updated";
    if (/consent|subscribe|unsubscribe/i.test(topic)) eventType = "consent.changed";
    else if (/list/i.test(topic)) eventType = "audience.member_added";
    else if (/order/i.test(topic)) eventType = "order.created";
    return [
      {
        workspaceId,
        provider: "klaviyo",
        externalEventId: `${topic}:${externalId}`,
        eventType,
        occurredAt: new Date().toISOString(),
        externalObjectType: "contact",
        externalObjectId: externalId,
        email: (attrs.email as string) || null,
        phone: (attrs.phone_number as string) || null,
        idempotencyKey: makeEventIdempotencyKey("klaviyo", `${topic}:${externalId}`, eventType),
        payload: p,
      },
    ];
  },

  async createTestRecord(ctx) {
    const result = await this.upsertContact!(ctx, {
      email: `transovo-test-${Date.now()}@example.com`,
      firstName: "Transovo",
      lastName: "Integration Test Contact",
      // Do not set SMS consent merely because a phone exists
      phone: undefined,
    });
    return {
      objectType: "contact",
      externalId: result.externalId,
      label: "Transovo Integration Test Contact",
    };
  },

  async readTestRecord(ctx, _t, id) {
    return klFetch(ctx, `/profiles/${id}/`) as Promise<Record<string, unknown>>;
  },

  async updateTestRecord(ctx, _t, id) {
    return this.upsertContact!(ctx, {
      id,
      lastName: "Integration Test Contact Updated",
    });
  },

  async cleanupTestRecord(ctx, _t, id) {
    // Klaviyo profiles are typically suppressed rather than hard-deleted via API.
    try {
      await klFetch(ctx, `/profile-suppression-bulk-create-jobs/`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            type: "profile-suppression-bulk-create-job",
            attributes: {
              profiles: { data: [{ type: "profile", id }] },
            },
          },
        }),
      });
    } catch {
      // ignore cleanup failures
    }
  },

  async refreshMetadata(ctx) {
    const lists = await this.listAudiences!(ctx);
    const metrics = await klFetch<{ data?: unknown[] }>(ctx, "/metrics/?page[size]=20");
    return { lists: lists.items, metrics: metrics.data || [] };
  },
};
