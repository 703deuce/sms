/**
 * Pipedrive adapter — Persons / Organizations / Deals / Activities.
 */

import type { CrmConnector, ConnectorContext, UpsertResult } from "../connector";
import { crmFetch } from "../http";
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

function apiBase(ctx: ConnectorContext) {
  const domain = String(ctx.meta.apiDomain || "https://api.pipedrive.com").replace(/\/$/, "");
  return `${domain}/v1`;
}

async function pd<T>(ctx: ConnectorContext, path: string, init?: RequestInit) {
  return crmFetch<{ success: boolean; data: T; additional_data?: { pagination?: { next_start?: number } } }>(
    `${apiBase(ctx)}${path}`,
    { ...init, accessToken: ctx.accessToken },
  );
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

  async listContacts(ctx, cursor) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/persons?start=${start}&limit=100`,
    );
    const items: CrmContact[] = (res.data || []).map((r) => {
      const phones = (r.phone as Array<{ value?: string }>) || [];
      const emails = (r.email as Array<{ value?: string }>) || [];
      return {
        id: String(r.id),
        firstName: (r.first_name as string) || null,
        lastName: (r.last_name as string) || (r.name as string) || null,
        phone: phones[0]?.value || null,
        email: emails[0]?.value || null,
        companyName: (r.org_name as string) || null,
        ownerExternalId: r.owner_id != null ? String(r.owner_id) : null,
      };
    });
    const next = res.additional_data?.pagination?.next_start;
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

  async upsertContact(ctx, contact) {
    const body = {
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Unknown",
      first_name: contact.firstName || undefined,
      last_name: contact.lastName || undefined,
      phone: contact.phone ? [{ value: contact.phone, primary: true }] : undefined,
      email: contact.email ? [{ value: contact.email, primary: true }] : undefined,
      owner_id: contact.ownerExternalId
        ? Number(contact.ownerExternalId)
        : ctx.preferences.defaultOwnerExternalId
          ? Number(ctx.preferences.defaultOwnerExternalId)
          : undefined,
    };
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

  async listCompanies(ctx, cursor) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(
      ctx,
      `/organizations?start=${start}&limit=100`,
    );
    return {
      items: (res.data || []).map(
        (r): CrmCompany => ({
          id: String(r.id),
          name: String(r.name || "Organization"),
          phone: null,
          website: null,
        }),
      ),
      nextCursor:
        res.additional_data?.pagination?.next_start != null
          ? String(res.additional_data.pagination.next_start)
          : null,
    };
  },

  async upsertCompany(ctx, company) {
    if (company.id) {
      await pd(ctx, `/organizations/${company.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: company.name }),
      });
      return { externalId: company.id, created: false };
    }
    const created = await pd<{ id: number }>(ctx, "/organizations", {
      method: "POST",
      body: JSON.stringify({ name: company.name }),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async listDeals(ctx, cursor) {
    const start = cursor ? Number(cursor) : 0;
    const res = await pd<Array<Record<string, unknown>>>(ctx, `/deals?start=${start}&limit=100`);
    return {
      items: (res.data || []).map(
        (r): CrmDeal => ({
          id: String(r.id),
          name: String(r.title || "Deal"),
          amount: r.value != null ? Number(r.value) : null,
          currency: (r.currency as string) || null,
          stage: r.stage_id != null ? String(r.stage_id) : null,
          pipeline: r.pipeline_id != null ? String(r.pipeline_id) : null,
          contactExternalId: r.person_id != null ? String(r.person_id) : null,
          companyExternalId: r.org_id != null ? String(r.org_id) : null,
          status: (r.status as string) || null,
        }),
      ),
      nextCursor:
        res.additional_data?.pagination?.next_start != null
          ? String(res.additional_data.pagination.next_start)
          : null,
    };
  },

  async upsertDeal(ctx, deal) {
    const body = {
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
    };
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
    const created = await pd<{ id: number }>(ctx, "/activities", {
      method: "POST",
      body: JSON.stringify({
        subject: task.subject,
        note: task.description,
        type: "task",
        due_date: task.dueAt ? task.dueAt.slice(0, 10) : undefined,
        person_id: task.contactExternalId ? Number(task.contactExternalId) : undefined,
        done: task.status === "Completed" ? 1 : 0,
      }),
    });
    return { externalId: String(created.data.id), created: true } satisfies UpsertResult;
  },

  async createNote(ctx, note) {
    const created = await pd<{ id: number }>(ctx, "/notes", {
      method: "POST",
      body: JSON.stringify({
        content: note.body,
        person_id: note.contactExternalId ? Number(note.contactExternalId) : undefined,
      }),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async logCall(ctx, call) {
    const note = [
      call.notes,
      call.disposition ? `Disposition: ${call.disposition}` : null,
      call.recordingUrl && ctx.preferences.syncRecordings ? `Recording: ${call.recordingUrl}` : null,
      call.transcriptUrl && ctx.preferences.syncTranscripts
        ? `Transcript: ${call.transcriptUrl}`
        : null,
      call.aiSummary || null,
    ]
      .filter(Boolean)
      .join("\n\n");
    const created = await pd<{ id: number }>(ctx, "/activities", {
      method: "POST",
      body: JSON.stringify({
        subject: call.subject || `${call.direction} call via Transovo`,
        type: "call",
        note,
        duration: call.durationSeconds ? Math.round(call.durationSeconds / 60) : undefined,
        person_id: call.contactExternalId ? Number(call.contactExternalId) : undefined,
        done: 1,
      }),
    });
    return { externalId: String(created.data.id), created: true };
  },

  async logSms(ctx, sms) {
    const created = await pd<{ id: number }>(ctx, "/activities", {
      method: "POST",
      body: JSON.stringify({
        subject: `${sms.direction} SMS via Transovo`,
        type: "sms",
        note: sms.body,
        person_id: sms.contactExternalId ? Number(sms.contactExternalId) : undefined,
        done: 1,
      }),
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
  },
};
