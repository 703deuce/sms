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

/**
 * Close Lead is company/account-like and contains contacts/opportunities.
 * We map Close Lead → company-ish storage via objectType "lead" with metadata,
 * and Close Contact → contact. Do not treat Close Lead as Transovo generic lead.
 */
const caps: CapabilityDefinition = {
  objects: {
    lead: "read_write",
    contact: "read_write",
    deal: "read_write",
    task: "read_write",
    note: "read_write",
    call_activity: "write_only",
    sms_activity: "write_only",
  },
  events: {
    "contact.created": "read_write",
    "contact.updated": "read_write",
    "deal.created": "read_write",
    "deal.stage_changed": "read_write",
    "task.created": "read_write",
  },
  actions: {
    upsert_contact: "read_write",
    upsert_deal: "read_write",
    create_task: "read_write",
    create_note: "read_write",
  },
  webhooks: "read_write",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function closeFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  return integrationFetch<T>(`https://api.close.com/api/v1${path}`, {
    ...init,
    basicAuth: { username: ctx.accessToken, password: "" },
  });
}

export const closeAdapter: ExternalIntegrationAdapter = {
  id: "close",
  displayName: "Close CRM",
  authKind: "credentials",
  credentialFields: [
    {
      key: "apiKey",
      label: "API key",
      type: "password",
      required: true,
      help: "Tied to your Close user/org. Prefer OAuth later for polished UX.",
    },
  ],
  capabilities: caps,

  async validateConnection(ctx) {
    const me = await closeFetch<{
      id?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      organization_id?: string;
    }>(ctx, "/me/");
    return {
      ok: true,
      accountId: me.organization_id || me.id || "",
      accountName: [me.first_name, me.last_name].filter(Boolean).join(" ") || me.email || "Close",
      capabilities: ["leads", "contacts", "opportunities", "tasks", "activities"],
      details: {
        userId: me.id,
        email: me.email,
        dataModelNote:
          "Close Lead ≈ account/company container; contacts live under leads.",
      },
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return {
      accountId: h.accountId || "",
      accountName: h.accountName || "Close",
      details: h.details,
    };
  },

  async listContacts(ctx, cursor) {
    // Close contacts are nested under leads — list leads and flatten contacts.
    const params = new URLSearchParams({ _limit: "50" });
    if (cursor) params.set("_skip", cursor);
    const data = await closeFetch<{
      data?: Array<Record<string, unknown>>;
      has_more?: boolean;
    }>(ctx, `/lead/?${params}`);
    const items: NormalizedContact[] = [];
    for (const lead of data.data || []) {
      const contacts = (lead.contacts as Array<Record<string, unknown>>) || [];
      for (const c of contacts) {
        const emails = (c.emails as Array<{ email?: string }>) || [];
        const phones = (c.phones as Array<{ phone?: string }>) || [];
        items.push({
          id: String(c.id),
          firstName: (c.name as string)?.split(" ")[0] || null,
          lastName: (c.name as string)?.split(" ").slice(1).join(" ") || null,
          email: emails[0]?.email || null,
          phone: phones[0]?.phone || null,
          company: (lead.display_name as string) || (lead.name as string) || null,
          customFields: { closeLeadId: lead.id },
          updatedAt: (lead.date_updated as string) || null,
          raw: { contact: c, leadId: lead.id },
        });
      }
    }
    const skip = cursor ? Number(cursor) : 0;
    return {
      items,
      nextCursor: data.has_more ? String(skip + 50) : null,
    };
  },

  async upsertContact(ctx, contact) {
    const leadId = String(contact.customFields?.closeLeadId || "");
    if (contact.id && leadId) {
      await closeFetch(ctx, `/contact/${contact.id}/`, {
        method: "PUT",
        body: JSON.stringify({
          name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
          emails: contact.email ? [{ email: contact.email, type: "office" }] : undefined,
          phones: contact.phone ? [{ phone: contact.phone, type: "mobile" }] : undefined,
        }),
      });
      return { externalId: String(contact.id), created: false };
    }
    // Create lead + contact
    const data = await closeFetch<{ id?: string; contacts?: Array<{ id?: string }> }>(
      ctx,
      "/lead/",
      {
        method: "POST",
        body: JSON.stringify({
          name: contact.company || "Transovo Integration Test Lead",
          contacts: [
            {
              name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
                "Transovo Integration Test Contact",
              emails: contact.email ? [{ email: contact.email, type: "office" }] : [],
              phones: contact.phone ? [{ phone: contact.phone, type: "mobile" }] : [],
            },
          ],
        }),
      },
    );
    const contactId = data.contacts?.[0]?.id || data.id || "";
    return { externalId: String(contactId), created: true };
  },

  async listDeals(ctx, cursor) {
    const params = new URLSearchParams({ _limit: "50" });
    if (cursor) params.set("_skip", cursor);
    const data = await closeFetch<{
      data?: Array<Record<string, unknown>>;
      has_more?: boolean;
    }>(ctx, `/opportunity/?${params}`);
    const items: NormalizedDeal[] = (data.data || []).map((d) => ({
      id: String(d.id),
      title: (d.lead_name as string) || null,
      amount: d.value != null ? Number(d.value) / 100 : null,
      stageId: (d.status_id as string) || null,
      pipelineId: (d.pipeline_id as string) || null,
      contactId: (d.contact_id as string) || null,
      companyId: (d.lead_id as string) || null,
      status: (d.status_label as string) || (d.status_type as string) || null,
      updatedAt: (d.date_updated as string) || null,
      raw: d,
    }));
    const skip = cursor ? Number(cursor) : 0;
    return { items, nextCursor: data.has_more ? String(skip + 50) : null };
  },

  async upsertDeal(ctx, deal) {
    if (deal.id) {
      await closeFetch(ctx, `/opportunity/${deal.id}/`, {
        method: "PUT",
        body: JSON.stringify({
          status_id: deal.stageId,
          value: deal.amount != null ? Math.round(deal.amount * 100) : undefined,
        }),
      });
      return { externalId: String(deal.id), created: false };
    }
    const data = await closeFetch<{ id?: string }>(ctx, "/opportunity/", {
      method: "POST",
      body: JSON.stringify({
        lead_id: deal.companyId,
        status_id: deal.stageId,
        value: deal.amount != null ? Math.round(deal.amount * 100) : 0,
        value_period: "one_time",
        note: deal.title,
      }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  async createTask(ctx, task) {
    const data = await closeFetch<{ id?: string }>(ctx, "/task/", {
      method: "POST",
      body: JSON.stringify({
        text: task.title,
        lead_id: task.contactId,
        date: task.dueAt,
        is_complete: false,
      }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  async createNote(ctx, note) {
    const data = await closeFetch<{ id?: string }>(ctx, "/activity/note/", {
      method: "POST",
      body: JSON.stringify({
        note: note.body,
        lead_id: note.parentId || note.contactId,
      }),
    });
    return { externalId: String(data.id || ""), created: true };
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as { event?: Record<string, unknown> };
    const event = p.event || (payload as Record<string, unknown>);
    const objectType = String(event.object_type || event.type || "contact");
    const action = String(event.action || "updated");
    const data = (event.data || event) as Record<string, unknown>;
    const externalId = String(data.id || event.id || Date.now());
    let eventType: NormalizedEvent["eventType"] = "contact.updated";
    if (objectType.includes("opportunity")) {
      eventType = action.includes("status") ? "deal.stage_changed" : "deal.created";
    } else if (objectType.includes("task")) eventType = "task.created";
    else if (action === "created") eventType = "contact.created";
    return [
      {
        workspaceId,
        provider: "close",
        externalEventId: `${objectType}:${externalId}:${action}`,
        eventType,
        occurredAt: String(event.date_updated || new Date().toISOString()),
        externalObjectType: objectType.includes("opportunity") ? "deal" : "contact",
        externalObjectId: externalId,
        email: null,
        phone: null,
        idempotencyKey: makeEventIdempotencyKey(
          "close",
          `${objectType}:${externalId}:${action}`,
          eventType,
        ),
        payload: event,
      },
    ];
  },

  async createTestRecord(ctx) {
    const result = await this.upsertContact!(ctx, {
      firstName: "Transovo",
      lastName: "Integration Test Contact",
      email: `transovo-test-${Date.now()}@example.com`,
      phone: "+15555550103",
      company: "Transovo Integration Test Lead",
    });
    return {
      objectType: "contact",
      externalId: result.externalId,
      label: "Transovo Integration Test Contact",
    };
  },

  async readTestRecord(ctx, _t, id) {
    return closeFetch(ctx, `/contact/${id}/`) as Promise<Record<string, unknown>>;
  },

  async updateTestRecord(ctx, _t, id) {
    await closeFetch(ctx, `/contact/${id}/`, {
      method: "PUT",
      body: JSON.stringify({ name: "Transovo Integration Test Contact Updated" }),
    });
    return { externalId: id, created: false };
  },

  async cleanupTestRecord(ctx, _t, id) {
    try {
      const contact = await closeFetch<{ lead_id?: string }>(ctx, `/contact/${id}/`);
      if (contact.lead_id) {
        await closeFetch(ctx, `/lead/${contact.lead_id}/`, { method: "DELETE" });
      }
    } catch {
      // ignore
    }
  },
};
