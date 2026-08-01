import type { ExternalIntegrationAdapter } from "../framework/adapter";
import { integrationFetch } from "../framework/http";
import { makeEventIdempotencyKey } from "../framework/events";
import type {
  AdapterContext,
  CapabilityDefinition,
  NormalizedEvent,
  NormalizedForm,
  NormalizedFormSubmission,
} from "../framework/types";

const caps: CapabilityDefinition = {
  objects: {
    form: "read_only",
    form_submission: "read_only",
  },
  events: {
    "form.submitted": "read_write",
    "lead.submitted": "read_write",
  },
  actions: {},
  webhooks: "read_write",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function apiBase(ctx: AdapterContext) {
  return String(ctx.meta.apiBase || "https://api.typeform.com").replace(/\/$/, "");
}

function tfFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  return integrationFetch<T>(`${apiBase(ctx)}${path}`, {
    ...init,
    accessToken: ctx.accessToken,
  });
}

function extractContact(answers: Array<Record<string, unknown>> | undefined) {
  let email: string | null = null;
  let phone: string | null = null;
  const mapped: Record<string, unknown> = {};
  for (const a of answers || []) {
    const type = String(a.type || "");
    const field = (a.field as { id?: string; ref?: string } | undefined) || {};
    const key = field.ref || field.id || type;
    if (type === "email") email = (a.email as string) || null;
    if (type === "phone_number") phone = (a.phone_number as string) || null;
    mapped[String(key)] = a[type] ?? a.text ?? a.boolean ?? a.number ?? a;
  }
  return { email, phone, answers: mapped };
}

export const typeformAdapter: ExternalIntegrationAdapter = {
  id: "typeform",
  displayName: "Typeform",
  authKind: "oauth",
  oauth: {
    authorizationUrl: "https://api.typeform.com/oauth/authorize",
    tokenUrl: "https://api.typeform.com/oauth/token",
    clientIdEnv: "TYPEFORM_CLIENT_ID",
    clientSecretEnv: "TYPEFORM_CLIENT_SECRET",
    scopes: ["forms:read", "responses:read", "webhooks:read", "webhooks:write", "offline", "accounts:read"],
  },
  capabilities: caps,

  parseTokenResponse(json) {
    const expiresIn = Number(json.expires_in || 0);
    return {
      accessToken: String(json.access_token || ""),
      refreshToken: json.refresh_token ? String(json.refresh_token) : null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    };
  },

  async validateConnection(ctx) {
    const me = await tfFetch<{ alias?: string; email?: string; user_id?: string }>(ctx, "/me");
    return {
      ok: true,
      accountId: String(me.user_id || me.email || ""),
      accountName: me.alias || me.email || "Typeform",
      scopes: this.oauth?.scopes || [],
      capabilities: ["forms", "responses", "webhooks"],
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return { accountId: h.accountId || "", accountName: h.accountName || "Typeform" };
  },

  async listForms(ctx, cursor) {
    const page = cursor ? Number(cursor) : 1;
    const data = await tfFetch<{ items?: Array<Record<string, unknown>>; page_count?: number }>(
      ctx,
      `/forms?page_size=50&page=${page}`,
    );
    const items: NormalizedForm[] = (data.items || []).map((f) => ({
      id: String(f.id),
      name: String(f.title || f.id),
      status: f.settings ? "active" : null,
      updatedAt: (f.last_updated_at as string) || null,
      raw: f,
    }));
    return {
      items,
      nextCursor: page < (data.page_count || 1) ? String(page + 1) : null,
    };
  },

  async listFormSubmissions(ctx, formId, cursor, opts) {
    const params = new URLSearchParams({ page_size: "50" });
    if (cursor) params.set("before", cursor);
    if (opts?.modifiedSince) params.set("since", opts.modifiedSince.toISOString());
    const data = await tfFetch<{
      items?: Array<Record<string, unknown>>;
    }>(ctx, `/forms/${formId}/responses?${params}`);
    const items: NormalizedFormSubmission[] = (data.items || []).map((r) => {
      const extracted = extractContact(r.answers as Array<Record<string, unknown>>);
      return {
        id: String(r.response_id || r.token || ""),
        formId,
        email: extracted.email,
        phone: extracted.phone,
        answers: extracted.answers,
        submittedAt: (r.submitted_at as string) || (r.landed_at as string) || null,
        raw: r,
      };
    });
    const next =
      items.length >= 50 ? String(items[items.length - 1]?.id || "") || null : null;
    return { items, nextCursor: next };
  },

  async registerWebhooks(ctx, callbackUrl) {
    const forms = await this.listForms!(ctx);
    const ids: string[] = [];
    for (const form of forms.items.slice(0, 20)) {
      if (!form.id) continue;
      if (ctx.preferences.includedIds.length && !ctx.preferences.includedIds.includes(form.id)) {
        continue;
      }
      try {
        const tag = "transovo";
        await tfFetch(ctx, `/forms/${form.id}/webhooks/${tag}`, {
          method: "PUT",
          body: JSON.stringify({ url: callbackUrl, enabled: true }),
        });
        ids.push(`${form.id}:${tag}`);
      } catch {
        // continue
      }
    }
    return { ids };
  },

  async removeWebhooks(ctx, ids) {
    for (const id of ids || []) {
      const [formId, tag] = id.split(":");
      if (!formId) continue;
      try {
        await tfFetch(ctx, `/forms/${formId}/webhooks/${tag || "transovo"}`, {
          method: "DELETE",
        });
      } catch {
        // ignore
      }
    }
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const body = payload as {
      form_response?: {
        form_id?: string;
        token?: string;
        submitted_at?: string;
        answers?: Array<Record<string, unknown>>;
        hidden?: Record<string, unknown>;
      };
    };
    const fr = body.form_response || (payload as typeof body.form_response);
    const extracted = extractContact(fr?.answers);
    const externalId = String(fr?.token || Date.now());
    return [
      {
        workspaceId,
        provider: "typeform",
        externalEventId: externalId,
        eventType: "form.submitted",
        occurredAt: fr?.submitted_at || new Date().toISOString(),
        externalObjectType: "form_submission",
        externalObjectId: externalId,
        email: extracted.email,
        phone: extracted.phone,
        idempotencyKey: makeEventIdempotencyKey("typeform", externalId, "form.submitted"),
        payload: {
          formId: fr?.form_id,
          answers: extracted.answers,
          hidden: fr?.hidden,
        },
      },
    ];
  },

  async createTestRecord(ctx) {
    const forms = await this.listForms!(ctx);
    const first = forms.items[0];
    return {
      objectType: "form",
      externalId: String(first?.id || "none"),
      label: first?.name || "Transovo Integration Test Form (read probe)",
    };
  },

  async readTestRecord(ctx, _t, id) {
    if (!id || id === "none") return null;
    return tfFetch(ctx, `/forms/${id}`) as Promise<Record<string, unknown>>;
  },

  async refreshMetadata(ctx) {
    const forms = await this.listForms!(ctx);
    return { forms: forms.items };
  },
};
