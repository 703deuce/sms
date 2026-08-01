/**
 * Zoho CRM / Bigin adapter — regional API host from OAuth api_domain.
 */

import type { CrmConnector, ConnectorContext, UpsertResult } from "../connector";
import { crmFetch } from "../http";
import { scopesForProvider } from "../scopes";
import type {
  CrmCallActivity,
  CrmCompany,
  CrmContact,
  CrmDeal,
  CrmLead,
  CrmNote,
  CrmSmsActivity,
  CrmTask,
  CrmUser,
} from "../types";

function apiBase(ctx: ConnectorContext) {
  const domain = String(ctx.meta.apiDomain || "https://www.zohoapis.com").replace(/\/$/, "");
  return `${domain}/crm/v2`;
}

export const zohoConnector: CrmConnector = {
  id: "zoho",
  displayName: "Zoho CRM / Bigin",
  oauth: {
    authorizationUrl: "https://accounts.zoho.com/oauth/v2/auth",
    tokenUrl: "https://accounts.zoho.com/oauth/v2/token",
    scopes: scopesForProvider("zoho"),
    clientIdEnv: "ZOHO_CLIENT_ID",
    clientSecretEnv: "ZOHO_CLIENT_SECRET",
    authorizeParams: { access_type: "offline", prompt: "consent" },
  },

  parseTokenResponse(json) {
    const expiresIn = Number(json.expires_in || 3600);
    return {
      accessToken: String(json.access_token || ""),
      refreshToken: json.refresh_token ? String(json.refresh_token) : null,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      externalId: json.api_domain ? String(json.api_domain) : null,
      meta: {
        apiDomain: json.api_domain ? String(json.api_domain) : "https://www.zohoapis.com",
        tokenType: json.token_type ? String(json.token_type) : undefined,
        accountsServer: json.accounts_server ? String(json.accounts_server) : undefined,
      },
    };
  },

  async validateConnection(ctx) {
    try {
      const data = await crmFetch<{ users?: Array<{ id: string; full_name?: string }> }>(
        `${apiBase(ctx)}/users?type=CurrentUser`,
        { accessToken: ctx.accessToken },
      );
      const user = data.users?.[0];
      return {
        ok: true,
        state: "connected",
        externalAccountId: user?.id || null,
        externalAccountName: user?.full_name || null,
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
    const page = cursor ? Number(cursor) : 1;
    const data = await crmFetch<{
      data?: Array<Record<string, unknown>>;
      info?: { more_records?: boolean };
    }>(`${apiBase(ctx)}/Contacts?page=${page}&per_page=200`, {
      accessToken: ctx.accessToken,
    });
    return {
      items: (data.data || []).map(
        (r): CrmContact => ({
          id: String(r.id),
          firstName: (r.First_Name as string) || null,
          lastName: (r.Last_Name as string) || null,
          phone: (r.Phone as string) || (r.Mobile as string) || null,
          email: (r.Email as string) || null,
          companyName:
            typeof r.Account_Name === "object" && r.Account_Name
              ? String((r.Account_Name as { name?: string }).name || "")
              : null,
        }),
      ),
      nextCursor: data.info?.more_records ? String(page + 1) : null,
    };
  },

  async findContactByPhone(ctx, phone) {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const data = await crmFetch<{ data?: Array<Record<string, unknown>> }>(
      `${apiBase(ctx)}/Contacts/search?phone=${encodeURIComponent(digits)}`,
      { accessToken: ctx.accessToken },
    ).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
    const r = data.data?.[0];
    if (!r) return null;
    return {
      id: String(r.id),
      firstName: (r.First_Name as string) || null,
      lastName: (r.Last_Name as string) || null,
      phone: (r.Phone as string) || (r.Mobile as string) || null,
      email: (r.Email as string) || null,
    };
  },

  async upsertContact(ctx, contact) {
    const body = {
      data: [
        {
          id: contact.id || undefined,
          First_Name: contact.firstName,
          Last_Name: contact.lastName || "Unknown",
          Phone: contact.phone,
          Email: contact.email,
          Lead_Source: contact.source || "Transovo",
        },
      ],
    };
    if (contact.id) {
      await crmFetch(`${apiBase(ctx)}/Contacts`, {
        method: "PUT",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: contact.id, created: false };
    }
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Contacts`,
      {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho contact create failed");
    return { externalId: id, created: true };
  },

  async listLeads(ctx, cursor) {
    const page = cursor ? Number(cursor) : 1;
    const data = await crmFetch<{ data?: Array<Record<string, unknown>>; info?: { more_records?: boolean } }>(
      `${apiBase(ctx)}/Leads?page=${page}&per_page=200`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.data || []).map(
        (r): CrmLead => ({
          id: String(r.id),
          firstName: (r.First_Name as string) || null,
          lastName: (r.Last_Name as string) || null,
          phone: (r.Phone as string) || null,
          email: (r.Email as string) || null,
          companyName: (r.Company as string) || null,
          source: (r.Lead_Source as string) || null,
        }),
      ),
      nextCursor: data.info?.more_records ? String(page + 1) : null,
    };
  },

  async upsertLead(ctx, lead) {
    const body = {
      data: [
        {
          id: lead.id || undefined,
          First_Name: lead.firstName,
          Last_Name: lead.lastName || "Unknown",
          Phone: lead.phone,
          Email: lead.email,
          Company: lead.companyName || "Unknown",
          Lead_Source: lead.source || "Transovo",
        },
      ],
    };
    if (lead.id) {
      await crmFetch(`${apiBase(ctx)}/Leads`, {
        method: "PUT",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: lead.id, created: false };
    }
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Leads`,
      { method: "POST", accessToken: ctx.accessToken, body: JSON.stringify(body) },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho lead create failed");
    return { externalId: id, created: true };
  },

  async listDeals(ctx, cursor) {
    const page = cursor ? Number(cursor) : 1;
    const data = await crmFetch<{ data?: Array<Record<string, unknown>>; info?: { more_records?: boolean } }>(
      `${apiBase(ctx)}/Deals?page=${page}&per_page=200`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.data || []).map(
        (r): CrmDeal => ({
          id: String(r.id),
          name: String(r.Deal_Name || "Deal"),
          amount: r.Amount != null ? Number(r.Amount) : null,
          stage: (r.Stage as string) || null,
          pipeline: (r.Pipeline as string) || null,
        }),
      ),
      nextCursor: data.info?.more_records ? String(page + 1) : null,
    };
  },

  async upsertDeal(ctx, deal) {
    const body = {
      data: [
        {
          id: deal.id || undefined,
          Deal_Name: deal.name,
          Amount: deal.amount,
          Stage: deal.stage,
          Pipeline: deal.pipeline,
        },
      ],
    };
    if (deal.id) {
      await crmFetch(`${apiBase(ctx)}/Deals`, {
        method: "PUT",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: deal.id, created: false };
    }
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Deals`,
      { method: "POST", accessToken: ctx.accessToken, body: JSON.stringify(body) },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho deal create failed");
    return { externalId: id, created: true };
  },

  async createTask(ctx, task) {
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Tasks`,
      {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          data: [
            {
              Subject: task.subject,
              Description: task.description,
              Due_Date: task.dueAt ? task.dueAt.slice(0, 10) : undefined,
              Status: task.status || "Not Started",
              Who_Id: task.contactExternalId || undefined,
            },
          ],
        }),
      },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho task create failed");
    return { externalId: id, created: true };
  },

  async createNote(ctx, note) {
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Notes`,
      {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          data: [
            {
              Note_Title: "Transovo note",
              Note_Content: note.body,
              Parent_Id: note.contactExternalId || undefined,
              se_module: "Contacts",
            },
          ],
        }),
      },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho note create failed");
    return { externalId: id, created: true };
  },

  async logCall(ctx, call) {
    const description = [
      call.notes,
      call.disposition ? `Disposition: ${call.disposition}` : null,
      call.recordingUrl && ctx.preferences.syncRecordings ? `Recording: ${call.recordingUrl}` : null,
      call.transcriptText && ctx.preferences.syncTranscripts ? call.transcriptText : null,
    ]
      .filter(Boolean)
      .join("\n\n");
    return zohoConnector.createTask!(ctx, {
      subject: `${call.direction} call via Transovo`,
      description,
      status: "Completed",
      contactExternalId: call.contactExternalId,
      dueAt: call.startedAt,
    });
  },

  async logSms(ctx, sms) {
    return zohoConnector.createTask!(ctx, {
      subject: `${sms.direction} SMS via Transovo`,
      description: sms.body || "",
      status: "Completed",
      contactExternalId: sms.contactExternalId,
      dueAt: sms.sentAt,
    });
  },

  async listCompanies(ctx, cursor) {
    const page = cursor ? Number(cursor) : 1;
    const data = await crmFetch<{
      data?: Array<Record<string, unknown>>;
      info?: { more_records?: boolean };
    }>(`${apiBase(ctx)}/Accounts?page=${page}&per_page=200`, {
      accessToken: ctx.accessToken,
    });
    return {
      items: (data.data || []).map(
        (r): CrmCompany => ({
          id: String(r.id),
          name: String(r.Account_Name || r.name || "Account"),
          phone: (r.Phone as string) || null,
          website: (r.Website as string) || null,
        }),
      ),
      nextCursor: data.info?.more_records ? String(page + 1) : null,
    };
  },

  async upsertCompany(ctx, company) {
    const body = {
      data: [
        {
          id: company.id || undefined,
          Account_Name: company.name,
          Phone: company.phone,
          Website: company.website,
        },
      ],
    };
    if (company.id) {
      await crmFetch(`${apiBase(ctx)}/Accounts`, {
        method: "PUT",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: company.id, created: false };
    }
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Accounts`,
      { method: "POST", accessToken: ctx.accessToken, body: JSON.stringify(body) },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho account create failed");
    return { externalId: id, created: true };
  },

  async listUsers(ctx) {
    const data = await crmFetch<{ users?: Array<Record<string, unknown>> }>(
      `${apiBase(ctx)}/users?type=ActiveUsers`,
      { accessToken: ctx.accessToken },
    );
    return (data.users || []).map(
      (r): CrmUser => ({
        externalId: String(r.id),
        name: (r.full_name as string) || (r.name as string) || null,
        email: (r.email as string) || null,
      }),
    );
  },

  async listFields(ctx) {
    const out: Array<{ objectType: string; name: string; label: string }> = [];
    for (const module of ["Contacts", "Leads", "Tasks", "Calls"] as const) {
      try {
        const data = await crmFetch<{
          fields?: Array<{ api_name?: string; field_label?: string; display_label?: string }>;
        }>(`${apiBase(ctx)}/settings/fields?module=${module}`, { accessToken: ctx.accessToken });
        for (const f of data.fields || []) {
          if (!f.api_name) continue;
          out.push({
            objectType: module.toLowerCase().replace(/s$/, ""),
            name: f.api_name,
            label: f.field_label || f.display_label || f.api_name,
          });
        }
      } catch {
        // continue
      }
    }
    return out.slice(0, 400);
  },

  async listPipelines(ctx) {
    // Zoho deal pipelines vary by org; expose a soft default when stages are readable.
    try {
      const data = await crmFetch<{
        fields?: Array<{
          api_name?: string;
          pick_list_values?: Array<{ display_value?: string; actual_value?: string }>;
        }>;
      }>(`${apiBase(ctx)}/settings/fields?module=Deals`, { accessToken: ctx.accessToken });
      const stage = data.fields?.find((f) => f.api_name === "Stage");
      const stages = (stage?.pick_list_values || []).map((p, i) => ({
        id: String(p.actual_value || p.display_value || i),
        name: String(p.display_value || p.actual_value || "Stage"),
        order: i,
      }));
      return [{ id: "deals", name: "Deals", stages }];
    } catch {
      return [];
    }
  },
};
