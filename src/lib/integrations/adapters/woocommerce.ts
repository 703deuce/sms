import type { ExternalIntegrationAdapter } from "../framework/adapter";
import { integrationFetch } from "../framework/http";
import { makeEventIdempotencyKey } from "../framework/events";
import type {
  AdapterContext,
  CapabilityDefinition,
  NormalizedContact,
  NormalizedEvent,
  NormalizedOrder,
} from "../framework/types";

const caps: CapabilityDefinition = {
  objects: {
    ecommerce_customer: "read_write",
    order: "read_only",
    product: "read_only",
    note: "write_only",
  },
  events: {
    "order.created": "read_write",
    "order.paid": "read_write",
    "order.status_changed": "read_write",
    "order.fulfilled": "read_write",
    "customer.updated": "read_write",
  },
  actions: {
    upsert_customer: "read_write",
    add_order_note: "read_write",
    update_order_metadata: "scope_dependent",
  },
  webhooks: "read_write",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function store(ctx: AdapterContext) {
  return String(ctx.meta.storeUrl || "").replace(/\/$/, "");
}

function wooFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  const key = String(ctx.meta.consumerKey || "");
  const secret = ctx.accessToken;
  return integrationFetch<T>(`${store(ctx)}/wp-json/wc/v3${path}`, {
    ...init,
    basicAuth: { username: key, password: secret },
  });
}

export const woocommerceAdapter: ExternalIntegrationAdapter = {
  id: "woocommerce",
  displayName: "WooCommerce",
  authKind: "credentials",
  credentialFields: [
    { key: "storeUrl", label: "Store URL", type: "url", required: true },
    { key: "consumerKey", label: "Consumer key", type: "password", required: true },
    { key: "consumerSecret", label: "Consumer secret", type: "password", required: true },
  ],
  capabilities: caps,

  async validateConnection(ctx) {
    if (!store(ctx)) return { ok: false, message: "Store URL required" };
    if (!String(ctx.meta.consumerKey || "") || !ctx.accessToken) {
      return { ok: false, message: "Consumer key and secret required" };
    }
    const sys = await wooFetch<{
      environment?: { version?: string };
      settings?: { title?: string };
    }>(ctx, "/system_status");
    // Also verify customers endpoint readable
    await wooFetch(ctx, "/customers?per_page=1");
    return {
      ok: true,
      accountId: store(ctx),
      accountName: store(ctx).replace(/^https?:\/\//, ""),
      capabilities: ["customers", "orders", "products", "webhooks"],
      details: {
        wooVersion: sys.environment?.version,
        https: store(ctx).startsWith("https://"),
      },
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return { accountId: h.accountId || store(ctx), accountName: h.accountName || "WooCommerce" };
  },

  async listContacts(ctx, cursor) {
    const page = cursor ? Number(cursor) : 1;
    const data = await wooFetch<Array<Record<string, unknown>>>(
      ctx,
      `/customers?per_page=50&page=${page}`,
    );
    const items: NormalizedContact[] = data.map((c) => ({
      id: String(c.id),
      email: (c.email as string) || null,
      firstName: (c.first_name as string) || null,
      lastName: (c.last_name as string) || null,
      phone: ((c.billing as { phone?: string } | undefined)?.phone as string) || null,
      company: ((c.billing as { company?: string } | undefined)?.company as string) || null,
      updatedAt: (c.date_modified_gmt as string) || null,
      raw: c,
    }));
    return { items, nextCursor: items.length >= 50 ? String(page + 1) : null };
  },

  async upsertCustomer(ctx, contact) {
    if (contact.id) {
      await wooFetch(ctx, `/customers/${contact.id}`, {
        method: "PUT",
        body: JSON.stringify({
          first_name: contact.firstName,
          last_name: contact.lastName,
          email: contact.email,
          billing: { phone: contact.phone, company: contact.company },
        }),
      });
      return { externalId: String(contact.id), created: false };
    }
    const data = await wooFetch<{ id?: number }>(ctx, "/customers", {
      method: "POST",
      body: JSON.stringify({
        email: contact.email,
        first_name: contact.firstName || "Transovo",
        last_name: contact.lastName || "Integration Test Contact",
        billing: { phone: contact.phone },
      }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  async listOrders(ctx, cursor, opts) {
    const page = cursor ? Number(cursor) : 1;
    const params = new URLSearchParams({ per_page: "50", page: String(page) });
    if (opts?.modifiedSince) params.set("modified_after", opts.modifiedSince.toISOString());
    const data = await wooFetch<Array<Record<string, unknown>>>(ctx, `/orders?${params}`);
    const items: NormalizedOrder[] = data.map((o) => {
      const billing = (o.billing || {}) as Record<string, string>;
      return {
        id: String(o.id),
        number: String(o.number || o.id),
        status: (o.status as string) || null,
        total: (o.total as string) || null,
        currency: (o.currency as string) || null,
        customerEmail: billing.email || null,
        customerPhone: billing.phone || null,
        customerName: [billing.first_name, billing.last_name].filter(Boolean).join(" ") || null,
        paidAt: (o.date_paid_gmt as string) || null,
        updatedAt: (o.date_modified_gmt as string) || null,
        raw: o,
      };
    });
    return { items, nextCursor: items.length >= 50 ? String(page + 1) : null };
  },

  async addOrderNote(ctx, orderId, note) {
    const data = await wooFetch<{ id?: number }>(ctx, `/orders/${orderId}/notes`, {
      method: "POST",
      body: JSON.stringify({ note, customer_note: false }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  async registerWebhooks(ctx, callbackUrl) {
    const topics = [
      "customer.created",
      "customer.updated",
      "order.created",
      "order.updated",
      "order.deleted",
    ];
    const ids: string[] = [];
    for (const topic of topics) {
      try {
        const created = await wooFetch<{ id?: number }>(ctx, "/webhooks", {
          method: "POST",
          body: JSON.stringify({
            name: `Transovo ${topic}`,
            topic,
            delivery_url: callbackUrl,
            status: "active",
          }),
        });
        if (created.id) ids.push(String(created.id));
      } catch {
        // continue
      }
    }
    return { ids };
  },

  async removeWebhooks(ctx, ids) {
    for (const id of ids || []) {
      try {
        await wooFetch(ctx, `/webhooks/${id}`, { method: "DELETE" });
      } catch {
        // ignore
      }
    }
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as Record<string, unknown>;
    const status = String(p.status || "");
    const id = String(p.id || Date.now());
    const billing = (p.billing || {}) as Record<string, string>;
    let eventType: NormalizedEvent["eventType"] = "order.status_changed";
    if (status === "completed") eventType = "order.fulfilled";
    else if (status === "processing" || p.date_paid) eventType = "order.paid";
    else if (p.email && !p.line_items) eventType = "customer.updated";
    else if (!status || status === "pending" || status === "on-hold") eventType = "order.created";
    return [
      {
        workspaceId,
        provider: "woocommerce",
        externalEventId: id,
        eventType,
        occurredAt: String(p.date_modified_gmt || new Date().toISOString()),
        externalObjectType: eventType.startsWith("customer") ? "ecommerce_customer" : "order",
        externalObjectId: id,
        email: billing.email || (p.email as string) || null,
        phone: billing.phone || null,
        idempotencyKey: makeEventIdempotencyKey("woocommerce", `${eventType}:${id}`, eventType),
        payload: { id, status, number: p.number, total: p.total },
      },
    ];
  },

  async createTestRecord(ctx) {
    const result = await this.upsertCustomer!(ctx, {
      email: `transovo-test-${Date.now()}@example.com`,
      firstName: "Transovo",
      lastName: "Integration Test Contact",
      phone: "+15555550102",
    });
    return {
      objectType: "ecommerce_customer",
      externalId: result.externalId,
      label: "Transovo Integration Test Contact",
    };
  },

  async readTestRecord(ctx, _t, id) {
    return wooFetch(ctx, `/customers/${id}`) as Promise<Record<string, unknown>>;
  },

  async updateTestRecord(ctx, _t, id) {
    return this.upsertCustomer!(ctx, {
      id,
      lastName: "Integration Test Contact Updated",
    });
  },

  async cleanupTestRecord(ctx, _t, id) {
    try {
      await wooFetch(ctx, `/customers/${id}?force=true`, { method: "DELETE" });
    } catch {
      // ignore
    }
  },
};
