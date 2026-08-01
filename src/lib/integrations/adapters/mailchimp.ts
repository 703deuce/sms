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
    tag: "read_write",
    segment: "read_only",
    campaign: "read_only",
    ecommerce_customer: "scope_dependent",
    order: "scope_dependent",
  },
  events: {
    "audience.member_added": "read_write",
    "audience.member_updated": "read_write",
    "tag.added": "read_write",
    "tag.removed": "read_write",
    "consent.changed": "read_write",
  },
  actions: {
    upsert_contact: "read_write",
    add_tag: "read_write",
    remove_tag: "read_write",
    add_to_list: "read_write",
    remove_from_list: "read_write",
    subscribe_marketing: "read_write",
    unsubscribe_marketing: "read_write",
  },
  webhooks: "read_write",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

async function ensureDc(ctx: AdapterContext) {
  if (ctx.meta.dc && ctx.meta.apiEndpoint) return;
  const meta = await integrationFetch<{ dc?: string; api_endpoint?: string; accountname?: string }>(
    "https://login.mailchimp.com/oauth2/metadata",
    { accessToken: ctx.accessToken },
  );
  ctx.meta.dc = meta.dc;
  ctx.meta.apiEndpoint = meta.api_endpoint;
  ctx.meta.accountName = meta.accountname;
}

function apiRoot(ctx: AdapterContext) {
  const endpoint = String(ctx.meta.apiEndpoint || `https://${ctx.meta.dc}.api.mailchimp.com`);
  return `${endpoint.replace(/\/$/, "")}/3.0`;
}

function mcFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  return integrationFetch<T>(`${apiRoot(ctx)}${path}`, {
    ...init,
    accessToken: ctx.accessToken,
  });
}

export const mailchimpAdapter: ExternalIntegrationAdapter = {
  id: "mailchimp",
  displayName: "Mailchimp",
  authKind: "oauth",
  oauth: {
    authorizationUrl: "https://login.mailchimp.com/oauth2/authorize",
    tokenUrl: "https://login.mailchimp.com/oauth2/token",
    clientIdEnv: "MAILCHIMP_CLIENT_ID",
    clientSecretEnv: "MAILCHIMP_CLIENT_SECRET",
    scopes: [],
  },
  capabilities: caps,

  parseTokenResponse(json) {
    return {
      accessToken: String(json.access_token || ""),
      refreshToken: null,
      expiresAt: null,
      meta: {},
    };
  },

  async validateConnection(ctx) {
    await ensureDc(ctx);
    const data = await mcFetch<{
      account_id?: string | number;
      account_name?: string;
      email?: string;
    }>(ctx, "/");
    return {
      ok: true,
      accountId: String(data.account_id || ctx.meta.dc || ""),
      accountName: data.account_name || data.email || String(ctx.meta.accountName || "Mailchimp"),
      capabilities: ["audiences", "members", "tags", "webhooks", "batches"],
      details: { dc: ctx.meta.dc, apiEndpoint: ctx.meta.apiEndpoint },
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return {
      accountId: h.accountId || "",
      accountName: h.accountName || "Mailchimp",
      details: h.details,
    };
  },

  async listAudiences(ctx, cursor) {
    await ensureDc(ctx);
    const offset = cursor ? Number(cursor) : 0;
    const data = await mcFetch<{
      lists?: Array<Record<string, unknown>>;
      total_items?: number;
    }>(ctx, `/lists?count=50&offset=${offset}`);
    const total = data.total_items || 0;
    return {
      items: (data.lists || []).map((l) => ({
        id: String(l.id),
        name: String(l.name || ""),
        memberCount: (l.stats as { member_count?: number } | undefined)?.member_count ?? null,
        raw: l,
      })),
      nextCursor: offset + 50 < total ? String(offset + 50) : null,
    };
  },

  async listContacts(ctx, cursor) {
    await ensureDc(ctx);
    const audiences = await this.listAudiences!(ctx);
    const listId = String(audiences.items[0]?.id || "");
    if (!listId) return { items: [], nextCursor: null };
    const offset = cursor ? Number(cursor) : 0;
    const data = await mcFetch<{
      members?: Array<Record<string, unknown>>;
      total_items?: number;
    }>(ctx, `/lists/${listId}/members?count=50&offset=${offset}`);
    const items: NormalizedContact[] = (data.members || []).map((m) => {
      const merge = (m.merge_fields || {}) as Record<string, unknown>;
      return {
        id: String(m.id || m.email_address),
        email: (m.email_address as string) || null,
        phone: (merge.PHONE as string) || null,
        firstName: (merge.FNAME as string) || null,
        lastName: (merge.LNAME as string) || null,
        updatedAt: (m.last_changed as string) || null,
        customFields: {
          status: m.status,
          listId,
          consentsource: m.marketing_permissions,
        },
        raw: m,
      };
    });
    const total = data.total_items || 0;
    return { items, nextCursor: offset + 50 < total ? String(offset + 50) : null };
  },

  async upsertContact(ctx, contact) {
    await ensureDc(ctx);
    const audiences = await this.listAudiences!(ctx);
    const listId = String(
      ctx.preferences.includedIds[0] || audiences.items[0]?.id || "",
    );
    if (!listId) throw new Error("No Mailchimp audience available");
    if (!contact.email) throw new Error("Email required for Mailchimp member upsert");

    // Never force subscribe cleaned/unsubscribed automatically — use pending unless explicit.
    const status =
      (contact.customFields?.status as string) ||
      (ctx.preferences.providerSettings.subscribeOnUpsert ? "subscribed" : "pending");

    const { createHash } = await import("crypto");
    const hash = createHash("md5")
      .update(contact.email.trim().toLowerCase())
      .digest("hex");
    const data = await mcFetch<{ id?: string; status?: string }>(
      ctx,
      `/lists/${listId}/members/${hash}`,
      {
        method: "PUT",
        body: JSON.stringify({
          email_address: contact.email,
          status_if_new: status === "subscribed" ? "subscribed" : "pending",
          merge_fields: {
            FNAME: contact.firstName || "",
            LNAME: contact.lastName || "",
            ...(contact.phone ? { PHONE: contact.phone } : {}),
          },
        }),
      },
    );
    return { externalId: String(data.id || hash), created: true };
  },

  async addTag(ctx, externalContactId, tag) {
    await ensureDc(ctx);
    const audiences = await this.listAudiences!(ctx);
    const listId = String(ctx.preferences.includedIds[0] || audiences.items[0]?.id || "");
    await mcFetch(ctx, `/lists/${listId}/members/${externalContactId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags: [{ name: tag, status: "active" }] }),
    });
  },

  async removeTag(ctx, externalContactId, tag) {
    await ensureDc(ctx);
    const audiences = await this.listAudiences!(ctx);
    const listId = String(ctx.preferences.includedIds[0] || audiences.items[0]?.id || "");
    await mcFetch(ctx, `/lists/${listId}/members/${externalContactId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags: [{ name: tag, status: "inactive" }] }),
    });
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as { type?: string; data?: Record<string, unknown> };
    const type = p.type || "profile";
    const data = p.data || {};
    const email = (data.email as string) || null;
    const externalId = String(data.id || data.web_id || email || Date.now());
    let eventType: NormalizedEvent["eventType"] = "audience.member_updated";
    if (type === "subscribe") eventType = "audience.member_added";
    if (type === "unsubscribe" || type === "cleaned") eventType = "consent.changed";
    return [
      {
        workspaceId,
        provider: "mailchimp",
        externalEventId: `${type}:${externalId}`,
        eventType,
        occurredAt: new Date().toISOString(),
        externalObjectType: "contact",
        externalObjectId: externalId,
        email,
        phone: (data.merges as { PHONE?: string } | undefined)?.PHONE || null,
        idempotencyKey: makeEventIdempotencyKey(
          "mailchimp",
          `${type}:${externalId}`,
          eventType,
        ),
        payload: { type, data },
      },
    ];
  },

  async createTestRecord(ctx) {
    const result = await this.upsertContact!(ctx, {
      email: `transovo-test-${Date.now()}@example.com`,
      firstName: "Transovo",
      lastName: "Integration Test Contact",
      customFields: { status: "pending" },
    });
    return {
      objectType: "contact",
      externalId: result.externalId,
      label: "Transovo Integration Test Contact",
    };
  },

  async readTestRecord(ctx, _t, id) {
    await ensureDc(ctx);
    const audiences = await this.listAudiences!(ctx);
    const listId = String(audiences.items[0]?.id || "");
    return mcFetch(ctx, `/lists/${listId}/members/${id}`) as Promise<Record<string, unknown>>;
  },

  async updateTestRecord(ctx, _t, id) {
    await ensureDc(ctx);
    const audiences = await this.listAudiences!(ctx);
    const listId = String(audiences.items[0]?.id || "");
    await mcFetch(ctx, `/lists/${listId}/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ merge_fields: { LNAME: "Integration Test Contact Updated" } }),
    });
    return { externalId: id, created: false };
  },

  async cleanupTestRecord(ctx, _t, id) {
    try {
      await ensureDc(ctx);
      const audiences = await this.listAudiences!(ctx);
      const listId = String(audiences.items[0]?.id || "");
      await mcFetch(ctx, `/lists/${listId}/members/${id}`, { method: "DELETE" });
    } catch {
      // archive may be preferred; ignore cleanup failures
    }
  },

  async refreshMetadata(ctx) {
    await ensureDc(ctx);
    const lists = await this.listAudiences!(ctx);
    return { dc: ctx.meta.dc, apiEndpoint: ctx.meta.apiEndpoint, lists: lists.items };
  },
};
