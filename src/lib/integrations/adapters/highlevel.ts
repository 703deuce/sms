import type { ExternalIntegrationAdapter } from "../framework/adapter";
import { integrationFetch } from "../framework/http";
import { makeEventIdempotencyKey } from "../framework/events";
import type {
  AdapterContext,
  CapabilityDefinition,
  NormalizedAppointment,
  NormalizedContact,
  NormalizedDeal,
  NormalizedEvent,
} from "../framework/types";

const caps: CapabilityDefinition = {
  objects: {
    contact: "read_write",
    deal: "read_write",
    appointment: "read_write",
    tag: "read_write",
    task: "read_write",
    note: "write_only",
    pipeline: "read_only",
  },
  events: {
    "contact.created": "scope_dependent",
    "contact.updated": "scope_dependent",
    "deal.created": "scope_dependent",
    "deal.stage_changed": "scope_dependent",
    "appointment.scheduled": "scope_dependent",
    "task.created": "scope_dependent",
  },
  actions: {
    upsert_contact: "read_write",
    add_tag: "read_write",
    remove_tag: "read_write",
    upsert_deal: "read_write",
    create_task: "read_write",
    create_note: "write_only",
  },
  webhooks: "scope_dependent",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function loc(ctx: AdapterContext) {
  return String(ctx.meta.locationId || "");
}

function hlFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  return integrationFetch<T>(`https://services.leadconnectorhq.com${path}`, {
    ...init,
    accessToken: ctx.accessToken,
    headers: {
      Version: "2021-07-28",
      ...(init?.headers || {}),
    },
  });
}

export const highlevelAdapter: ExternalIntegrationAdapter = {
  id: "highlevel",
  displayName: "HighLevel (Private Token)",
  authKind: "credentials",
  credentialFields: [
    { key: "privateToken", label: "Private Integration Token", type: "password", required: true },
    { key: "locationId", label: "Location ID", required: true },
    { key: "agencyId", label: "Agency / account ID (optional)", required: false },
  ],
  capabilities: caps,

  async validateConnection(ctx) {
    if (!loc(ctx)) return { ok: false, message: "Location ID required" };
    // PIT validates against location contacts endpoint
    const data = await hlFetch<{ contacts?: unknown[]; location?: Record<string, unknown> }>(
      ctx,
      `/contacts/?locationId=${encodeURIComponent(loc(ctx))}&limit=1`,
    );
    let accountName = `HighLevel ${loc(ctx)}`;
    try {
      const location = await hlFetch<{ location?: { name?: string; id?: string } }>(
        ctx,
        `/locations/${loc(ctx)}`,
      );
      accountName = location.location?.name || accountName;
    } catch {
      // location read may require extra scope
    }
    return {
      ok: true,
      accountId: loc(ctx),
      accountName,
      capabilities: ["contacts", "opportunities", "calendars", "tasks"],
      details: {
        locationId: loc(ctx),
        connectionType: "private_integration_token",
        note: "Single location only — not universal HighLevel OAuth",
        sampleContacts: Array.isArray(data.contacts) ? data.contacts.length : 0,
      },
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return {
      accountId: h.accountId || loc(ctx),
      accountName: h.accountName || "HighLevel",
      details: h.details,
    };
  },

  async listContacts(ctx, cursor) {
    const params = new URLSearchParams({
      locationId: loc(ctx),
      limit: "50",
    });
    if (cursor) params.set("startAfterId", cursor);
    const data = await hlFetch<{
      contacts?: Array<Record<string, unknown>>;
      meta?: { nextPage?: string; startAfterId?: string };
    }>(ctx, `/contacts/?${params}`);
    const items: NormalizedContact[] = (data.contacts || []).map((c) => ({
      id: String(c.id),
      firstName: (c.firstName as string) || null,
      lastName: (c.lastName as string) || null,
      email: (c.email as string) || null,
      phone: (c.phone as string) || null,
      tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
      updatedAt: (c.dateUpdated as string) || null,
      raw: c,
    }));
    const next =
      data.meta?.startAfterId ||
      (items.length ? String(items[items.length - 1]?.id) : null);
    return {
      items,
      nextCursor: items.length >= 50 ? next : null,
    };
  },

  async upsertContact(ctx, contact) {
    if (contact.id) {
      await hlFetch(ctx, `/contacts/${contact.id}`, {
        method: "PUT",
        body: JSON.stringify({
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          locationId: loc(ctx),
        }),
      });
      return { externalId: String(contact.id), created: false };
    }
    const data = await hlFetch<{ contact?: { id?: string } }>(ctx, "/contacts/", {
      method: "POST",
      body: JSON.stringify({
        firstName: contact.firstName || "Transovo",
        lastName: contact.lastName || "Contact",
        email: contact.email,
        phone: contact.phone,
        locationId: loc(ctx),
      }),
    });
    return { externalId: String(data.contact?.id || ""), created: true };
  },

  async addTag(ctx, externalContactId, tag) {
    await hlFetch(ctx, `/contacts/${externalContactId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags: [tag] }),
    });
  },

  async removeTag(ctx, externalContactId, tag) {
    await hlFetch(ctx, `/contacts/${externalContactId}/tags`, {
      method: "DELETE",
      body: JSON.stringify({ tags: [tag] }),
    });
  },

  async listDeals(ctx, cursor) {
    const params = new URLSearchParams({ location_id: loc(ctx), limit: "50" });
    if (cursor) params.set("startAfter", cursor);
    const data = await hlFetch<{
      opportunities?: Array<Record<string, unknown>>;
    }>(ctx, `/opportunities/search?${params}`);
    const items: NormalizedDeal[] = (data.opportunities || []).map((d) => ({
      id: String(d.id),
      title: (d.name as string) || null,
      amount: d.monetaryValue != null ? Number(d.monetaryValue) : null,
      stageId: (d.pipelineStageId as string) || null,
      pipelineId: (d.pipelineId as string) || null,
      contactId: (d.contactId as string) || null,
      status: (d.status as string) || null,
      updatedAt: (d.updatedAt as string) || null,
      raw: d,
    }));
    return { items, nextCursor: items.length >= 50 ? String(items[items.length - 1]?.id) : null };
  },

  async upsertDeal(ctx, deal) {
    if (deal.id) {
      await hlFetch(ctx, `/opportunities/${deal.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: deal.title,
          monetaryValue: deal.amount,
          pipelineStageId: deal.stageId,
          status: deal.status,
        }),
      });
      return { externalId: String(deal.id), created: false };
    }
    const data = await hlFetch<{ opportunity?: { id?: string } }>(ctx, "/opportunities/", {
      method: "POST",
      body: JSON.stringify({
        name: deal.title || "Transovo opportunity",
        monetaryValue: deal.amount || 0,
        pipelineId: deal.pipelineId,
        pipelineStageId: deal.stageId,
        locationId: loc(ctx),
        contactId: deal.contactId,
      }),
    });
    return { externalId: String(data.opportunity?.id || ""), created: true };
  },

  async listAppointments(ctx, cursor) {
    const params = new URLSearchParams({ locationId: loc(ctx), limit: "50" });
    if (cursor) params.set("startAfter", cursor);
    try {
      const data = await hlFetch<{ events?: Array<Record<string, unknown>> }>(
        ctx,
        `/calendars/events?${params}`,
      );
      const items: NormalizedAppointment[] = (data.events || []).map((e) => ({
        id: String(e.id),
        title: (e.title as string) || null,
        startAt: e.startTime
          ? new Date(Number(e.startTime)).toISOString()
          : (e.startTime as string) || null,
        endAt: e.endTime ? new Date(Number(e.endTime)).toISOString() : null,
        status: (e.appointmentStatus as string) || null,
        inviteeEmail: null,
        inviteePhone: null,
        raw: e,
      }));
      return { items, nextCursor: null };
    } catch {
      return { items: [], nextCursor: null };
    }
  },

  async createTask(ctx, task) {
    const data = await hlFetch<{ task?: { id?: string } }>(ctx, "/contacts/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: task.title,
        body: task.description,
        dueDate: task.dueAt,
        contactId: task.contactId,
        locationId: loc(ctx),
      }),
    });
    return { externalId: String(data.task?.id || ""), created: true };
  },

  async createNote(ctx, note) {
    const data = await hlFetch<{ note?: { id?: string } }>(
      ctx,
      `/contacts/${note.contactId}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ body: note.body }),
      },
    );
    return { externalId: String(data.note?.id || ""), created: true };
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as Record<string, unknown>;
    const type = String(p.type || p.event || "ContactUpdate");
    const contact = (p.contact || p) as Record<string, unknown>;
    const externalId = String(contact.id || p.id || Date.now());
    let eventType: NormalizedEvent["eventType"] = "contact.updated";
    if (/appointment/i.test(type)) eventType = "appointment.scheduled";
    else if (/opportunit|deal/i.test(type)) eventType = "deal.created";
    else if (/task/i.test(type)) eventType = "task.created";
    else if (/create/i.test(type)) eventType = "contact.created";
    return [
      {
        workspaceId,
        provider: "highlevel",
        externalEventId: `${type}:${externalId}`,
        eventType,
        occurredAt: new Date().toISOString(),
        externalObjectType: eventType.startsWith("appointment")
          ? "appointment"
          : eventType.startsWith("deal")
            ? "deal"
            : "contact",
        externalObjectId: externalId,
        email: (contact.email as string) || null,
        phone: (contact.phone as string) || null,
        idempotencyKey: makeEventIdempotencyKey("highlevel", `${type}:${externalId}`, eventType),
        payload: p,
      },
    ];
  },

  async createTestRecord(ctx) {
    const result = await this.upsertContact!(ctx, {
      firstName: "Transovo",
      lastName: "Integration Test Contact",
      email: `transovo-test-${Date.now()}@example.com`,
      phone: "+15555550101",
    });
    return {
      objectType: "contact",
      externalId: result.externalId,
      label: "Transovo Integration Test Contact",
    };
  },

  async readTestRecord(ctx, _t, id) {
    return hlFetch(ctx, `/contacts/${id}`) as Promise<Record<string, unknown>>;
  },

  async updateTestRecord(ctx, _t, id) {
    return this.upsertContact!(ctx, {
      id,
      lastName: "Integration Test Contact Updated",
    });
  },

  async cleanupTestRecord(ctx, _t, id) {
    try {
      await hlFetch(ctx, `/contacts/${id}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  },
};
