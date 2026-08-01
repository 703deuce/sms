import type { ExternalIntegrationAdapter } from "../framework/adapter";
import { integrationFetch } from "../framework/http";
import { makeEventIdempotencyKey } from "../framework/events";
import type {
  AdapterContext,
  CapabilityDefinition,
  NormalizedContact,
  NormalizedDeal,
  NormalizedEvent,
} from "../framework/types";

const caps: CapabilityDefinition = {
  objects: {
    contact: "read_write",
    company: "read_write",
    deal: "read_write",
    tag: "read_write",
    audience: "read_write",
    note: "write_only",
  },
  events: {
    "contact.created": "read_write",
    "contact.updated": "read_write",
    "tag.added": "read_write",
    "tag.removed": "read_write",
    "deal.created": "read_write",
    "deal.stage_changed": "read_write",
  },
  actions: {
    upsert_contact: "read_write",
    add_tag: "read_write",
    remove_tag: "read_write",
    add_to_list: "read_write",
    remove_from_list: "read_write",
    upsert_deal: "read_write",
    create_note: "write_only",
  },
  webhooks: "scope_dependent",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function base(ctx: AdapterContext) {
  return String(ctx.meta.apiUrl || "").replace(/\/$/, "");
}

function acFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  return integrationFetch<T>(`${base(ctx)}/api/3${path}`, {
    ...init,
    headers: {
      "Api-Token": ctx.accessToken,
      ...(init?.headers || {}),
    },
  });
}

export const activecampaignAdapter: ExternalIntegrationAdapter = {
  id: "activecampaign",
  displayName: "ActiveCampaign",
  authKind: "credentials",
  credentialFields: [
    { key: "apiUrl", label: "Account API URL", type: "url", required: true },
    { key: "apiKey", label: "API key", type: "password", required: true },
  ],
  capabilities: caps,

  async validateConnection(ctx) {
    if (!base(ctx)) return { ok: false, message: "API URL required" };
    const me = await acFetch<{ user?: { id?: string; email?: string; username?: string } }>(
      ctx,
      "/users/me",
    );
    return {
      ok: true,
      accountId: String(me.user?.id || base(ctx)),
      accountName: me.user?.email || me.user?.username || base(ctx),
      capabilities: ["contacts", "lists", "tags", "deals", "accounts"],
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return { accountId: h.accountId || "", accountName: h.accountName || "ActiveCampaign" };
  },

  async listContacts(ctx, cursor) {
    const offset = cursor ? Number(cursor) : 0;
    const data = await acFetch<{
      contacts?: Array<Record<string, unknown>>;
      meta?: { total?: string };
    }>(ctx, `/contacts?limit=50&offset=${offset}`);
    const items: NormalizedContact[] = (data.contacts || []).map((c) => ({
      id: String(c.id),
      firstName: (c.firstName as string) || null,
      lastName: (c.lastName as string) || null,
      email: (c.email as string) || null,
      phone: (c.phone as string) || null,
      updatedAt: (c.updated_timestamp as string) || null,
      raw: c,
    }));
    const total = Number(data.meta?.total || 0);
    const next = offset + 50 < total ? String(offset + 50) : null;
    return { items, nextCursor: next };
  },

  async upsertContact(ctx, contact) {
    const body = {
      contact: {
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
      },
    };
    const data = await acFetch<{ contact?: { id?: string } }>(ctx, "/contact/sync", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(data.contact?.id || ""), created: true };
  },

  async listDeals(ctx, cursor) {
    const offset = cursor ? Number(cursor) : 0;
    const data = await acFetch<{ deals?: Array<Record<string, unknown>>; meta?: { total?: string } }>(
      ctx,
      `/deals?limit=50&offset=${offset}`,
    );
    const items: NormalizedDeal[] = (data.deals || []).map((d) => ({
      id: String(d.id),
      title: (d.title as string) || null,
      amount: d.value != null ? Number(d.value) / 100 : null,
      stageId: (d.stage as string) || null,
      contactId: (d.contact as string) || null,
      status: (d.status as string) || null,
      updatedAt: (d.mdate as string) || null,
      raw: d,
    }));
    const total = Number(data.meta?.total || 0);
    return { items, nextCursor: offset + 50 < total ? String(offset + 50) : null };
  },

  async upsertDeal(ctx, deal) {
    if (deal.id) {
      await acFetch(ctx, `/deals/${deal.id}`, {
        method: "PUT",
        body: JSON.stringify({
          deal: {
            title: deal.title,
            value: deal.amount != null ? Math.round(deal.amount * 100) : undefined,
            stage: deal.stageId,
          },
        }),
      });
      return { externalId: String(deal.id), created: false };
    }
    const data = await acFetch<{ deal?: { id?: string } }>(ctx, "/deals", {
      method: "POST",
      body: JSON.stringify({
        deal: {
          title: deal.title || "Transovo deal",
          value: deal.amount != null ? Math.round(deal.amount * 100) : 0,
          currency: deal.currency || "usd",
          stage: deal.stageId,
          contact: deal.contactId,
        },
      }),
    });
    return { externalId: String(data.deal?.id || ""), created: true };
  },

  async listTags(ctx) {
    const data = await acFetch<{ tags?: Array<{ id?: string; tag?: string }> }>(
      ctx,
      "/tags?limit=100",
    );
    return (data.tags || []).map((t) => ({ id: String(t.id), name: String(t.tag || "") }));
  },

  async addTag(ctx, externalContactId, tag) {
    let tagId: string | undefined;
    const tags = await this.listTags!(ctx);
    tagId = tags.find((t) => t.name.toLowerCase() === tag.toLowerCase())?.id || undefined;
    if (!tagId) {
      const created = await acFetch<{ tag?: { id?: string } }>(ctx, "/tags", {
        method: "POST",
        body: JSON.stringify({ tag: { tag, tagType: "contact" } }),
      });
      tagId = String(created.tag?.id || "");
    }
    await acFetch(ctx, "/contactTags", {
      method: "POST",
      body: JSON.stringify({ contactTag: { contact: externalContactId, tag: tagId } }),
    });
  },

  async addToList(ctx, externalContactId, listId) {
    await acFetch(ctx, "/contactLists", {
      method: "POST",
      body: JSON.stringify({
        contactList: { list: listId, contact: externalContactId, status: 1 },
      }),
    });
  },

  async removeFromList(ctx, externalContactId, listId) {
    await acFetch(ctx, "/contactLists", {
      method: "POST",
      body: JSON.stringify({
        contactList: { list: listId, contact: externalContactId, status: 2 },
      }),
    });
  },

  async createNote(ctx, note) {
    const data = await acFetch<{ note?: { id?: string } }>(ctx, "/notes", {
      method: "POST",
      body: JSON.stringify({
        note: { note: note.body, relid: note.contactId, reltype: "Subscriber" },
      }),
    });
    return { externalId: String(data.note?.id || ""), created: true };
  },

  async listAudiences(ctx, cursor) {
    const offset = cursor ? Number(cursor) : 0;
    const data = await acFetch<{ lists?: Array<Record<string, unknown>>; meta?: { total?: string } }>(
      ctx,
      `/lists?limit=50&offset=${offset}`,
    );
    const total = Number(data.meta?.total || 0);
    return {
      items: (data.lists || []).map((l) => ({
        id: String(l.id),
        name: String(l.name || ""),
        memberCount: l.subscriber_count != null ? Number(l.subscriber_count) : null,
        raw: l,
      })),
      nextCursor: offset + 50 < total ? String(offset + 50) : null,
    };
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as Record<string, unknown>;
    const type = String(p.type || p.event || "contact.updated");
    const contact = (p.contact || p) as Record<string, unknown>;
    const externalId = String(contact.id || p.id || `${type}:${Date.now()}`);
    let eventType: NormalizedEvent["eventType"] = "contact.updated";
    if (/tag.*add/i.test(type)) eventType = "tag.added";
    else if (/tag.*remov/i.test(type)) eventType = "tag.removed";
    else if (/deal.*stage/i.test(type)) eventType = "deal.stage_changed";
    else if (/deal/i.test(type)) eventType = "deal.created";
    else if (/contact.*add|subscribe/i.test(type)) eventType = "contact.created";
    return [
      {
        workspaceId,
        provider: "activecampaign",
        externalEventId: externalId,
        eventType,
        occurredAt: new Date().toISOString(),
        externalObjectType: eventType.startsWith("deal") ? "deal" : "contact",
        externalObjectId: externalId,
        email: (contact.email as string) || null,
        phone: (contact.phone as string) || null,
        idempotencyKey: makeEventIdempotencyKey("activecampaign", externalId, eventType),
        payload: p,
      },
    ];
  },

  async createTestRecord(ctx) {
    const result = await this.upsertContact!(ctx, {
      email: `transovo-test-${Date.now()}@example.com`,
      firstName: "Transovo",
      lastName: "Integration Test Contact",
      phone: "+15555550100",
    });
    return {
      objectType: "contact",
      externalId: result.externalId,
      label: "Transovo Integration Test Contact",
    };
  },

  async readTestRecord(ctx, _t, id) {
    return acFetch(ctx, `/contacts/${id}`) as Promise<Record<string, unknown>>;
  },

  async updateTestRecord(ctx, _t, id) {
    await acFetch(ctx, `/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        contact: { lastName: "Integration Test Contact Updated" },
      }),
    });
    return { externalId: id, created: false };
  },

  async cleanupTestRecord(ctx, _t, id) {
    try {
      await acFetch(ctx, `/contacts/${id}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  },
};
