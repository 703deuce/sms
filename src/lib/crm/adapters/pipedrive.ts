/**
 * Pipedrive adapter — Persons / Organizations / Deals / Activities.
 */

import type { CrmConnector, ConnectorContext, UpsertResult } from "../connector";
import { crmFetch } from "../http";
import { buildMappedPayload } from "../payloads";
import { scopesForProvider } from "../scopes";
import type {
  CrmCallActivity,
  CrmCompany,
  CrmContact,
  CrmDeal,
  CrmNote,
  CrmPipeline,
  CrmSmsActivity,
  CrmTask,
  CrmUser,
} from "../types";
// CrmTask used by listTasks

function apiBase(ctx: ConnectorContext) {
  const domain = String(ctx.meta.apiDomain || "https://api.pipedrive.com").replace(/\/$/, "");
  return `${domain}/v1`;
}

async function pd<T>(ctx: ConnectorContext, path: string, init?: RequestInit) {
  const res = await crmFetch<{
    success?: boolean;
    data?: T | null;
    additional_data?: { pagination?: { next_start?: number } };
  }>(`${apiBase(ctx)}${path}`, { ...init, accessToken: ctx.accessToken });
  return {
    success: res.success !== false,
    data: (res.data ?? null) as T,
    additional_data: res.additional_data,
  };
}

export const pipedriveConnector: CrmConnector = {
  id: "pipedrive",
  displayName: "Pipedrive",
  oauth: {
    authorizationUrl: "https://oauth.pipedrive.com/oauth/authorize",
    tokenUrl: "https://oauth.pipedrive.com/oauth/token",
    scopes: scopesForProvider("pipedrive"),
    clientIdEnv: "PIPEDRIVE_CLIENT_ID",
    clientSecretEnv: "PIPEDRIVE_CLIENT_SECRET",
  },

  parseTokenResponse(json) {
    const expiresIn = Number(json.expires_in || 3600);
    const apiDomain =
      typeof json.api_domain === "string"
        ? json.api_domain
        : typeof (json as { api_domain?: string }).api_domain === "string"
          ? (json as { api_domain: string }).api_domain
          : "https://api.pipedrive.com";
    return {
      accessToken: String(json.access_token || ""),
      refreshToken: json.refresh_token ? String(json.refresh_token) : null,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      externalId: json.company_id != null ? String(json.company_id) : null,
      meta: {
        apiDomain: String(apiDomain).replace(/\/$/, ""),
        companyId: json.company_id != null ? String(json.company_id) : undefined,
        companyName: json.company_name ? String(json.company_name) : undefined,
      },
    };
  },

  async validateConnection(ctx) {
    try {
      const res = await pd<{ id: number; name?: string; company_name?: string }>(ctx, "/users/me");
      return {
        ok: true,
        state: "connected",
        externalAccountId: String(res.data?.id || ""),
        externalAccountName: res.data?.company_name || res.data?.name || null,
      };
    } catch (err) {
      return {
        ok: false,
        state: "error",
        message: err instanceof Error ? err.message : "Validation failed",
      };
    }
  },

  async listContacts(ctx, cursor, opts) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/persons?start=${start}&limit=100&sort=update_time DESC`,
    );
    const sinceMs = opts?.modifiedSince?.getTime() ?? null;
    let stoppedEarly = false;
    const items: CrmContact[] = [];
    for (const r of res.data || []) {
      const updated = r.update_time ? new Date(String(r.update_time)).getTime() : 0;
      if (sinceMs != null && updated && updated < sinceMs) {
        stoppedEarly = true;
        break;
      }
      const phones = (r.phone as Array<{ value?: string }>) || [];
      const emails = (r.email as Array<{ value?: string }>) || [];
      items.push({
        id: String(r.id),
        firstName: (r.first_name as string) || null,
        lastName: (r.last_name as string) || (r.name as string) || null,
        phone: phones[0]?.value || null,
        email: emails[0]?.value || null,
        companyName: (r.org_name as string) || null,
        ownerExternalId: r.owner_id != null ? String(r.owner_id) : null,
        customFields: {
          lastModifiedAt: r.update_time ? String(r.update_time) : null,
        },
      });
    }
    const next = stoppedEarly ? null : res.additional_data?.pagination?.next_start;
    return { items, nextCursor: next != null ? String(next) : null };
  },

  async findContactByPhone(ctx, phone) {
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/persons/search?term=${encodeURIComponent(phone)}&fields=phone&limit=1`,
    ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
    const hit = (res.data as unknown as Array<{ item?: Record<string, unknown> }>)?.[0];
    const r = hit?.item || (res.data as Array<Record<string, unknown>>)?.[0];
    if (!r) return null;
    return {
      id: String(r.id),
      firstName: (r.first_name as string) || null,
      lastName: (r.last_name as string) || (r.name as string) || null,
      phone,
    };
  },

  async findContactByEmail(ctx, email) {
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/persons/search?term=${encodeURIComponent(email)}&fields=email&limit=1`,
    ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
    const hit = (res.data as unknown as Array<{ item?: Record<string, unknown> }>)?.[0];
    const r = hit?.item || (res.data as Array<Record<string, unknown>>)?.[0];
    if (!r) return null;
    return {
      id: String(r.id),
      firstName: (r.first_name as string) || null,
      lastName: (r.last_name as string) || (r.name as string) || null,
      email,
    };
  },

  async upsertContact(ctx, contact) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "contact",
      base: {
        name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown",
        first_name: contact.firstName || undefined,
        last_name: contact.lastName || undefined,
        phone: contact.phone ? [{ value: contact.phone, primary: true }] : undefined,
        email: contact.email ? [{ value: contact.email, primary: true }] : undefined,
        org_id: contact.companyExternalId ? Number(contact.companyExternalId) : undefined,
        owner_id: contact.ownerExternalId
          ? Number(contact.ownerExternalId)
          : ctx.preferences.defaultOwnerExternalId
            ? Number(ctx.preferences.defaultOwnerExternalId)
            : undefined,
      },
      customFields: contact.customFields,
    });
    // Resolve tag names → Pipedrive personLabels IDs (never send raw names as label_ids).
    if (contact.tags?.length) {
      try {
        const labels = (await this.listTags?.(ctx)) || [];
        const byName = new Map<string, string>();
        for (const t of labels) {
          if (t.id && t.name) byName.set(t.name.toLowerCase(), t.id);
        }
        const ids = contact.tags
          .map((name) => byName.get(name.toLowerCase()))
          .filter((id): id is string => Boolean(id))
          .map((id) => Number(id))
          .filter((n) => Number.isFinite(n));
        if (ids.length) body.label_ids = ids;
        else delete body.label_ids;
      } catch {
        delete body.label_ids;
      }
    } else {
      delete body.label_ids;
    }
    if (contact.id) {
      await pd(ctx, `/persons/${contact.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return { externalId: contact.id, created: false };
    }
    const created = await pd<{ id: number }>(ctx, "/persons", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async listCompanies(ctx, cursor, opts) {
    const start = cursor ? Number(cursor) : 0;
    let res: Awaited<ReturnType<typeof pd<Array<Record<string, unknown>>>>>;
    try {
      res = await pd<Array<Record<string, unknown>>>(
        ctx,
        `/organizations?start=${start}&limit=100&sort=update_time DESC`,
      );
    } catch (err) {
      // Sandbox / scope gaps often 403 organizations — don't fail the whole sync.
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (status === 403 || status === 401) {
        return { items: [], nextCursor: null };
      }
      throw err;
    }
    const sinceMs = opts?.modifiedSince?.getTime() ?? null;
    let stoppedEarly = false;
    const items: CrmCompany[] = [];
    for (const r of res.data || []) {
      const updated = r.update_time ? new Date(String(r.update_time)).getTime() : 0;
      if (sinceMs != null && updated && updated < sinceMs) {
        stoppedEarly = true;
        break;
      }
      items.push({
        id: String(r.id),
        name: String(r.name || "Organization"),
        phone: null,
        website: null,
        ownerExternalId: r.owner_id != null ? String(r.owner_id) : null,
      });
    }
    const next = stoppedEarly ? null : res.additional_data?.pagination?.next_start;
    return {
      items,
      nextCursor: next != null ? String(next) : null,
    };
  },

  async upsertCompany(ctx, company) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "company",
      base: {
        name: company.name,
        owner_id: company.ownerExternalId ? Number(company.ownerExternalId) : undefined,
      },
      customFields: company.customFields,
    });
    if (company.id) {
      await pd(ctx, `/organizations/${company.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return { externalId: company.id, created: false };
    }
    const created = await pd<{ id: number }>(ctx, "/organizations", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async listDeals(ctx, cursor, opts) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/deals?start=${start}&limit=100&sort=update_time DESC`,
    );
    const sinceMs = opts?.modifiedSince?.getTime() ?? null;
    let stoppedEarly = false;
    const items: CrmDeal[] = [];
    for (const r of res.data || []) {
      const updated = r.update_time ? new Date(String(r.update_time)).getTime() : 0;
      if (sinceMs != null && updated && updated < sinceMs) {
        stoppedEarly = true;
        break;
      }
      items.push({
        id: String(r.id),
        name: String(r.title || "Deal"),
        amount: r.value != null ? Number(r.value) : null,
        currency: (r.currency as string) || null,
        stage: r.stage_id != null ? String(r.stage_id) : null,
        pipeline: r.pipeline_id != null ? String(r.pipeline_id) : null,
        contactExternalId: r.person_id != null ? String(r.person_id) : null,
        companyExternalId: r.org_id != null ? String(r.org_id) : null,
        status: (r.status as string) || null,
        ownerExternalId: r.user_id != null ? String(r.user_id) : null,
      });
    }
    const next = stoppedEarly ? null : res.additional_data?.pagination?.next_start;
    return {
      items,
      nextCursor: next != null ? String(next) : null,
    };
  },

  async upsertDeal(ctx, deal) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "deal",
      base: {
        title: deal.name,
        value: deal.amount ?? undefined,
        currency: deal.currency || undefined,
        stage_id: deal.stage ? Number(deal.stage) : undefined,
        pipeline_id: deal.pipeline
          ? Number(deal.pipeline)
          : ctx.preferences.defaultPipelineId
            ? Number(ctx.preferences.defaultPipelineId)
            : undefined,
        person_id: deal.contactExternalId ? Number(deal.contactExternalId) : undefined,
        org_id: deal.companyExternalId ? Number(deal.companyExternalId) : undefined,
        status: deal.status || undefined,
      },
      customFields: deal.customFields,
    });
    if (deal.id) {
      await pd(ctx, `/deals/${deal.id}`, { method: "PUT", body: JSON.stringify(body) });
      return { externalId: deal.id, created: false };
    }
    const created = await pd<{ id: number }>(ctx, "/deals", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async createTask(ctx, task) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "task",
      base: {
        subject: task.subject,
        note: task.description,
        type: "task",
        due_date: task.dueAt ? task.dueAt.slice(0, 10) : undefined,
        person_id: task.contactExternalId ? Number(task.contactExternalId) : undefined,
        done: task.status === "Completed" ? 1 : 0,
      },
      customFields: task.customFields,
    });
    const created = await pd<{ id: number }>(ctx, "/activities", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(created.data.id), created: true } satisfies UpsertResult;
  },

  async createNote(ctx, note) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "note",
      base: {
        content: note.body,
        person_id: note.contactExternalId ? Number(note.contactExternalId) : undefined,
      },
      customFields: note.customFields,
    });
    const created = await pd<{ id: number }>(ctx, "/notes", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async updateNote(ctx, note) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "note",
      base: {
        content: note.body,
        person_id: note.contactExternalId ? Number(note.contactExternalId) : undefined,
      },
      customFields: note.customFields,
    });
    await pd(ctx, `/notes/${note.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { externalId: note.id, created: false };
  },

  async listTasks(ctx, cursor, opts) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/activities?start=${start}&limit=100&type=task&sort=update_time DESC`,
    );
    const sinceMs = opts?.modifiedSince?.getTime() ?? null;
    let stoppedEarly = false;
    const items: CrmTask[] = [];
    for (const r of res.data || []) {
      const updated = r.update_time ? new Date(String(r.update_time)).getTime() : 0;
      if (sinceMs != null && updated && updated < sinceMs) {
        stoppedEarly = true;
        break;
      }
      items.push({
        id: String(r.id),
        subject: String(r.subject || "Task"),
        description: (r.note as string) || null,
        status: r.done ? "Completed" : "Not Started",
        dueAt: (r.due_date as string) || null,
        contactExternalId: r.person_id != null ? String(r.person_id) : null,
      });
    }
    const next = stoppedEarly ? null : res.additional_data?.pagination?.next_start;
    return { items, nextCursor: next != null ? String(next) : null };
  },

  async listNotes(ctx, cursor) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(ctx, `/notes?start=${start}&limit=100`);
    return {
      items: (res.data || []).map((r) => ({
        id: String(r.id),
        body: String(r.content || ""),
        contactExternalId: r.person_id != null ? String(r.person_id) : null,
        updatedAt: (r.update_time as string) || null,
      })),
      nextCursor:
        res.additional_data?.pagination?.next_start != null
          ? String(res.additional_data.pagination.next_start)
          : null,
    };
  },

  async listActivities(ctx, cursor, opts) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/activities?start=${start}&limit=100&sort=update_time DESC`,
    );
    const sinceMs = opts?.modifiedSince?.getTime() ?? null;
    let stoppedEarly = false;
    const items = [];
    for (const r of res.data || []) {
      const updated = r.update_time ? new Date(String(r.update_time)).getTime() : 0;
      if (sinceMs != null && updated && updated < sinceMs) {
        stoppedEarly = true;
        break;
      }
      const type = String(r.type || "other");
      items.push({
        id: String(r.id),
        type:
          type === "call"
            ? ("call" as const)
            : type === "sms"
              ? ("sms" as const)
              : type === "task"
                ? ("task" as const)
                : ("other" as const),
        subject: String(r.subject || "Activity"),
        body: (r.note as string) || null,
        status: r.done ? "Completed" : "Open",
        dueAt: (r.due_date as string) || null,
        contactExternalId: r.person_id != null ? String(r.person_id) : null,
        updatedAt: (r.update_time as string) || null,
      });
    }
    const next = stoppedEarly ? null : res.additional_data?.pagination?.next_start;
    return { items, nextCursor: next != null ? String(next) : null };
  },

  async listTags(ctx) {
    try {
      const res = await pd<Array<Record<string, unknown>>>(ctx, "/personLabels");
      return (res.data || []).map((r) => ({
        id: String(r.id),
        name: String(r.name || r.label || ""),
        color: (r.color as string) || null,
      })).filter((t) => t.name);
    } catch {
      // INTENTIONAL: personLabels may be unavailable on some plans — degrade to no tags.
      return [];
    }
  },

  async handleWebhook(_ctx, _headers, body) {
    const payload = (body || {}) as Record<string, unknown>;
    const current = (payload.current || payload) as Record<string, unknown>;
    return { accepted: true, events: [current] };
  },

  async logCall(ctx, call) {
    const note = [
      call.notes,
      call.disposition ? `Disposition: ${call.disposition}` : null,
      call.durationSeconds != null ? `Duration: ${call.durationSeconds}s` : null,
      call.recordingUrl && ctx.preferences.syncRecordings ? `Recording: ${call.recordingUrl}` : null,
      call.transcriptUrl && ctx.preferences.syncTranscripts
        ? `Transcript: ${call.transcriptUrl}`
        : null,
      call.aiSummary && ctx.preferences.syncAiSummary ? `AI summary: ${call.aiSummary}` : null,
      call.transcriptText && ctx.preferences.syncTranscripts ? call.transcriptText : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "call",
      base: {
        subject: call.subject || `${call.direction} call via Transovo`,
        type: "call",
        note,
        duration: call.durationSeconds ? Math.round(call.durationSeconds / 60) : undefined,
        person_id: call.contactExternalId ? Number(call.contactExternalId) : undefined,
        done: 1,
      },
      customFields: {
        disposition: call.disposition,
        ...(call.customFields || {}),
      },
    });
    if (call.id) {
      await pd(ctx, `/activities/${call.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return { externalId: call.id, created: false };
    }
    const created = await pd<{ id: number }>(ctx, "/activities", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async updateTask(ctx, task) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "task",
      base: {
        subject: task.subject,
        note: task.description,
        done: task.status === "Completed" ? 1 : 0,
        person_id: task.contactExternalId ? Number(task.contactExternalId) : undefined,
      },
      customFields: task.customFields,
    });
    await pd(ctx, `/activities/${task.id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { externalId: task.id, created: false };
  },

  async logSms(ctx, sms) {
    const note = [
      sms.body,
      sms.mediaUrls?.length ? `Media: ${sms.mediaUrls.join(", ")}` : null,
      sms.status ? `Status: ${sms.status}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "pipedrive",
      objectType: "sms",
      base: {
        subject: `${sms.direction} SMS via Transovo`,
        type: "sms",
        note,
        person_id: sms.contactExternalId ? Number(sms.contactExternalId) : undefined,
        done: 1,
      },
      customFields: sms.customFields,
    });
    if (sms.id) {
      await pd(ctx, `/activities/${sms.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return { externalId: sms.id, created: false };
    }
    const created = await pd<{ id: number }>(ctx, "/activities", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async listUsers(ctx) {
    const res = await pd<Array<Record<string, unknown>>>(ctx, "/users");
    return (res.data || []).map(
      (r): CrmUser => ({
        externalId: String(r.id),
        name: (r.name as string) || null,
        email: (r.email as string) || null,
      }),
    );
  },

  async listPipelines(ctx) {
    try {
      const pipes = await pd<Array<Record<string, unknown>>>(ctx, "/pipelines");
      const stages = await pd<Array<Record<string, unknown>>>(ctx, "/stages");
      return (pipes.data || []).map(
        (p): CrmPipeline => ({
          id: String(p.id),
          name: String(p.name || "Pipeline"),
          stages: (stages.data || [])
            .filter((s) => String(s.pipeline_id) === String(p.id))
            .map((s) => ({
              id: String(s.id),
              name: String(s.name || "Stage"),
              order: s.order_nr != null ? Number(s.order_nr) : undefined,
            })),
        }),
      );
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (status === 403 || status === 401) return [];
      throw err;
    }
  },

  async listFields(ctx) {
    const out: Array<{ objectType: string; name: string; label: string }> = [];
    for (const [path, objectType] of [
      ["/personFields", "contact"],
      ["/organizationFields", "company"],
      ["/dealFields", "deal"],
    ] as const) {
      try {
        const res = await pd<Array<Record<string, unknown>>>(ctx, path);
        for (const f of res.data || []) {
          const key = String(f.key || f.name || "");
          if (!key) continue;
          out.push({
            objectType,
            name: key,
            label: String(f.name || key),
          });
        }
      } catch {
        // continue
      }
    }
    return out.slice(0, 400);
  },
};
