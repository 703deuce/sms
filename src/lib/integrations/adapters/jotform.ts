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
  webhooks: "scope_dependent",
  incrementalSync: "read_only",
  historicalImport: "read_only",
};

function apiBase(ctx: AdapterContext) {
  return String(ctx.meta.apiBase || "https://api.jotform.com").replace(/\/$/, "");
}

function jfFetch<T>(ctx: AdapterContext, path: string, init?: RequestInit) {
  const url = new URL(`${apiBase(ctx)}${path}`);
  if (!url.searchParams.has("apiKey")) url.searchParams.set("apiKey", ctx.accessToken);
  return integrationFetch<T>(url.toString(), init);
}

function extractFromAnswers(answers: Record<string, unknown> | undefined) {
  let email: string | null = null;
  let phone: string | null = null;
  const mapped: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(answers || {})) {
    const v = val as { name?: string; text?: string; answer?: unknown; type?: string };
    const name = (v.name || key).toLowerCase();
    const answer = v.answer ?? v.text;
    mapped[v.name || key] = answer;
    if (!email && (name.includes("email") || v.type === "control_email")) {
      email = typeof answer === "string" ? answer : null;
    }
    if (!phone && (name.includes("phone") || v.type === "control_phone")) {
      phone =
        typeof answer === "string"
          ? answer
          : answer && typeof answer === "object"
            ? String((answer as { full?: string }).full || "")
            : null;
    }
  }
  return { email, phone, answers: mapped };
}

export const jotformAdapter: ExternalIntegrationAdapter = {
  id: "jotform",
  displayName: "Jotform",
  authKind: "credentials",
  credentialFields: [
    { key: "apiKey", label: "API key", type: "password", required: true },
    { key: "apiBase", label: "API base (optional)", type: "url", required: false },
  ],
  capabilities: caps,

  async validateConnection(ctx) {
    const data = await jfFetch<{
      responseCode?: number;
      content?: { username?: string; name?: string; email?: string; account_type?: string };
      limit_left?: number;
    }>(ctx, "/user");
    if (data.responseCode && data.responseCode >= 400) {
      return { ok: false, message: "Invalid Jotform API key" };
    }
    const user = data.content || {};
    return {
      ok: true,
      accountId: user.username || user.email || "jotform",
      accountName: user.name || user.username || "Jotform",
      capabilities: ["forms", "submissions", "webhooks"],
      details: {
        accountType: user.account_type,
        limitLeft: data.limit_left,
        apiBase: apiBase(ctx),
      },
    };
  },

  async identifyAccount(ctx) {
    const h = await this.validateConnection(ctx);
    return {
      accountId: h.accountId || "",
      accountName: h.accountName || "Jotform",
      details: h.details,
    };
  },

  async listForms(ctx, cursor) {
    const offset = cursor ? Number(cursor) : 0;
    const data = await jfFetch<{
      content?: Array<Record<string, unknown>>;
      resultSet?: { count?: number };
    }>(ctx, `/user/forms?limit=50&offset=${offset}`);
    const items: NormalizedForm[] = (data.content || []).map((f) => ({
      id: String(f.id),
      name: String(f.title || f.id),
      status: (f.status as string) || null,
      updatedAt: (f.updated_at as string) || null,
      raw: f,
    }));
    return { items, nextCursor: items.length >= 50 ? String(offset + 50) : null };
  },

  async listFormSubmissions(ctx, formId, cursor) {
    const offset = cursor ? Number(cursor) : 0;
    const data = await jfFetch<{ content?: Array<Record<string, unknown>> }>(
      ctx,
      `/form/${formId}/submissions?limit=50&offset=${offset}`,
    );
    const items: NormalizedFormSubmission[] = (data.content || []).map((s) => {
      const extracted = extractFromAnswers(s.answers as Record<string, unknown>);
      return {
        id: String(s.id),
        formId,
        email: extracted.email,
        phone: extracted.phone,
        answers: extracted.answers,
        submittedAt: (s.created_at as string) || null,
        raw: s,
      };
    });
    return { items, nextCursor: items.length >= 50 ? String(offset + 50) : null };
  },

  async registerWebhooks(ctx, callbackUrl) {
    const forms = await this.listForms!(ctx);
    const ids: string[] = [];
    for (const form of forms.items.slice(0, 20)) {
      if (!form.id) continue;
      try {
        await jfFetch(ctx, `/form/${form.id}/webhooks`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ webhookURL: callbackUrl }).toString(),
        });
        ids.push(form.id);
      } catch {
        // continue
      }
    }
    return { ids };
  },

  normalizeWebhook(workspaceId, payload): NormalizedEvent[] {
    const p = payload as Record<string, unknown>;
    const submissionID = String(p.submissionID || p.id || Date.now());
    const rawRequest = p.rawRequest
      ? (typeof p.rawRequest === "string" ? JSON.parse(p.rawRequest) : p.rawRequest)
      : p;
    const answers = (rawRequest as { answers?: Record<string, unknown> }).answers || {};
    const extracted = extractFromAnswers(answers as Record<string, unknown>);
    // Also check flattened q fields
    if (!extracted.email) {
      for (const [k, v] of Object.entries(rawRequest as Record<string, unknown>)) {
        if (/email/i.test(k) && typeof v === "string") extracted.email = v;
        if (/phone/i.test(k) && typeof v === "string") extracted.phone = v;
      }
    }
    return [
      {
        workspaceId,
        provider: "jotform",
        externalEventId: submissionID,
        eventType: "form.submitted",
        occurredAt: new Date().toISOString(),
        externalObjectType: "form_submission",
        externalObjectId: submissionID,
        email: extracted.email,
        phone: extracted.phone,
        idempotencyKey: makeEventIdempotencyKey("jotform", submissionID, "form.submitted"),
        payload: {
          formID: p.formID,
          answers: extracted.answers,
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
    return jfFetch(ctx, `/form/${id}`) as Promise<Record<string, unknown>>;
  },

  async refreshMetadata(ctx) {
    const user = await this.validateConnection(ctx);
    const forms = await this.listForms!(ctx);
    return {
      limitLeft: user.details?.limitLeft,
      forms: forms.items,
    };
  },
};
