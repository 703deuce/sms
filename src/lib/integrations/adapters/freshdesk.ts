import type { ExternalIntegrationAdapter } from "../framework/adapter";
import { integrationFetch } from "../framework/http";
import { makeEventIdempotencyKey } from "../framework/events";
import type {
  AdapterContext,
  CapabilityDefinition,
  NormalizedContact,
  NormalizedEvent,
  NormalizedTicket,
} from "../framework/types";

const caps: CapabilityDefinition = {
  objects: {
    support_contact: "read_write",
    company: "read_write",
    support_ticket: "read_write",
    note: "write_only",
  },
  events: {
    "support_ticket.created": "read_write",
    "support_ticket.updated": "read_write",
    "support_ticket.solved": "read_write",
    "contact.updated": "read_write",
  },
  actions: {
    upsert_contact: "read_write",
    upsert_ticket: "read_write",
    add_ticket_comment: "read_write",
  },
  webhooks: "scope_dependent",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function domain(ctx: AdapterContext) {
  const sub = String(ctx.meta.subdomain || "").replace(/\.freshdesk\.com$/i, "");
  return `https://${sub}.freshdesk.com`;
}

function fdFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  return integrationFetch<T>(`${domain(ctx)}/api/v2${path}`, {
    ...init,
    basicAuth: { username: ctx.accessToken, password: "X" },
  });
}

export const freshdeskAdapter: ExternalIntegrationAdapter = {
  id: "freshdesk",
  displayName: "Freshdesk",
  authKind: "credentials",
  credentialFields: [
    { key: "subdomain", label: "Subdomain", required: true },
    { key: "apiKey", label: "API key", type: "password", required: true },
  ],
  capabilities: caps,

  async validateConnection(ctx) {
    if (!ctx.meta.subdomain) return { ok: false, message: "Subdomain required" };
    const me = await fdFetch<{
      id?: number;
      contact?: { name?: string; email?: string };
      name?: string;
      email?: string;
    }>(ctx, "/agents/me");
    return {
      ok: true,
      accountId: String(me.id || ctx.meta.subdomain),
      accountName: me.contact?.name || me.name || String(ctx.meta.subdomain),
      capabilities: ["contacts", "companies", "tickets", "conversations"],
      details: {
        email: me.contact?.email || me.email,
        subdomain: ctx.meta.subdomain,
      },
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return {
      accountId: h.accountId || "",
      accountName: h.accountName || "Freshdesk",
      details: h.details,
    };
  },

  async listContacts(ctx, cursor) {
    const page = cursor ? Number(cursor) : 1;
    const data = await fdFetch<Array<Record<string, unknown>>>(
      ctx,
      `/contacts?per_page=50&page=${page}`,
    );
    const items: NormalizedContact[] = data.map((c) => ({
      id: String(c.id),
      firstName: (c.name as string)?.split(" ")[0] || null,
      lastName: (c.name as string)?.split(" ").slice(1).join(" ") || null,
      email: (c.email as string) || null,
      phone: (c.phone as string) || (c.mobile as string) || null,
      company: null,
      updatedAt: (c.updated_at as string) || null,
      raw: c,
    }));
    return { items, nextCursor: items.length >= 50 ? String(page + 1) : null };
  },

  async upsertContact(ctx, contact) {
    const name =
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      "Transovo Integration Test Contact";
    if (contact.id) {
      await fdFetch(ctx, `/contacts/${contact.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          email: contact.email,
          phone: contact.phone,
        }),
      });
      return { externalId: String(contact.id), created: false };
    }
    const data = await fdFetch<{ id?: number }>(ctx, "/contacts", {
      method: "POST",
      body: JSON.stringify({
        name,
        email: contact.email,
        phone: contact.phone,
      }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  async listTickets(ctx, cursor, opts) {
    const page = cursor ? Number(cursor) : 1;
    let path = `/tickets?per_page=50&page=${page}&order_by=updated_at&order_type=desc`;
    if (opts?.modifiedSince) {
      // Freshdesk filter syntax varies; fall back to list + client filter if needed
      path = `/search/tickets?query="updated_at:>'${opts.modifiedSince.toISOString().slice(0, 10)}'"`;
      const searched = await fdFetch<{ results?: Array<Record<string, unknown>> }>(ctx, path);
      const items: NormalizedTicket[] = (searched.results || []).map((t) => ({
        id: String(t.id),
        subject: (t.subject as string) || null,
        status: String(t.status ?? ""),
        priority: String(t.priority ?? ""),
        requesterEmail: null,
        updatedAt: (t.updated_at as string) || null,
        raw: t,
      }));
      return { items, nextCursor: null };
    }
    const data = await fdFetch<Array<Record<string, unknown>>>(ctx, path);
    const items: NormalizedTicket[] = data.map((t) => ({
      id: String(t.id),
      subject: (t.subject as string) || null,
      status: String(t.status ?? ""),
      priority: String(t.priority ?? ""),
      requesterEmail: null,
      assigneeId: t.responder_id != null ? String(t.responder_id) : null,
      updatedAt: (t.updated_at as string) || null,
      raw: t,
    }));
    return { items, nextCursor: items.length >= 50 ? String(page + 1) : null };
  },

  async upsertTicket(ctx, ticket) {
    if (ticket.id) {
      await fdFetch(ctx, `/tickets/${ticket.id}`, {
        method: "PUT",
        body: JSON.stringify({
          subject: ticket.subject,
          status: ticket.status ? Number(ticket.status) : undefined,
          priority: ticket.priority ? Number(ticket.priority) : undefined,
        }),
      });
      return { externalId: String(ticket.id), created: false };
    }
    const data = await fdFetch<{ id?: number }>(ctx, "/tickets", {
      method: "POST",
      body: JSON.stringify({
        subject: ticket.subject || "Transovo Integration Test Ticket",
        description: "Created by Transovo integration acceptance test",
        email: ticket.requesterEmail || "transovo-test@example.com",
        priority: ticket.priority ? Number(ticket.priority) : 1,
        status: ticket.status ? Number(ticket.status) : 2,
      }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  async addTicketComment(ctx, ticketId, body, opts) {
    const data = await fdFetch<{ id?: number }>(ctx, `/tickets/${ticketId}/notes`, {
      method: "POST",
      body: JSON.stringify({
        body,
        private: opts?.private !== false,
      }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as Record<string, unknown>;
    const ticket = (p.ticket || p) as Record<string, unknown>;
    const id = String(ticket.id || p.id || Date.now());
    const status = Number(ticket.status || 0);
    let eventType: NormalizedEvent["eventType"] = "support_ticket.updated";
    if (status === 4 || status === 5) eventType = "support_ticket.solved";
    else if (p.triggered_event === "ticket_created" || !p.ticket) {
      eventType = "support_ticket.created";
    }
    return [
      {
        workspaceId,
        provider: "freshdesk",
        externalEventId: id,
        eventType,
        occurredAt: String(ticket.updated_at || new Date().toISOString()),
        externalObjectType: "support_ticket",
        externalObjectId: id,
        email: (ticket.requester as { email?: string } | undefined)?.email || null,
        phone: (ticket.requester as { phone?: string } | undefined)?.phone || null,
        idempotencyKey: makeEventIdempotencyKey("freshdesk", `${eventType}:${id}`, eventType),
        payload: { id, subject: ticket.subject, status: ticket.status },
      },
    ];
  },

  async createTestRecord(ctx) {
    const result = await this.upsertTicket!(ctx, {
      subject: "Transovo Integration Test Ticket",
      requesterEmail: `transovo-test-${Date.now()}@example.com`,
      priority: "1",
      status: "2",
    });
    return {
      objectType: "support_ticket",
      externalId: result.externalId,
      label: "Transovo Integration Test Ticket",
    };
  },

  async readTestRecord(ctx, _t, id) {
    return fdFetch(ctx, `/tickets/${id}`) as Promise<Record<string, unknown>>;
  },

  async updateTestRecord(ctx, _t, id) {
    return this.upsertTicket!(ctx, {
      id,
      subject: "Transovo Integration Test Ticket Updated",
    });
  },

  async cleanupTestRecord(ctx, _t, id) {
    try {
      await fdFetch(ctx, `/tickets/${id}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  },
};
