/**
 * Zoho CRM / Bigin adapter — regional API host from OAuth api_domain.
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
  CrmLead,
  CrmNote,
  CrmSmsActivity,
  CrmTask,
  CrmUser,
} from "../types";
// CrmTask used by listTasks mapping

function apiBase(ctx: ConnectorContext) {
  const domain = String(ctx.meta.apiDomain || "https://www.zohoapis.com").replace(/\/$/, "");
  // Bigin uses a separate API root — do not call Zoho CRM Leads modules.
  if (ctx.preferences.zohoProduct === "bigin") {
    return `${domain}/bigin/v2`;
  }
  return `${domain}/crm/v2`;
}

function isBigin(ctx: ConnectorContext) {
  return ctx.preferences.zohoProduct === "bigin";
}

export const zohoConnector: CrmConnector = {
  id: "zoho",
  displayName: "Zoho CRM",
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

  async listContacts(ctx, cursor, opts) {
    const page = cursor ? Number(cursor) : 1;
    let path = `${apiBase(ctx)}/Contacts?page=${page}&per_page=200`;
    if (opts?.modifiedSince) {
      const criteria = encodeURIComponent(
        `(Modified_Time:greater_equal:${opts.modifiedSince.toISOString()})`,
      );
      path = `${apiBase(ctx)}/Contacts/search?criteria=${criteria}&page=${page}&per_page=200`;
    }
    const data = await crmFetch<{
      data?: Array<Record<string, unknown>>;
      info?: { more_records?: boolean };
    }>(path, {
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
          ownerExternalId:
            typeof r.Owner === "object" && r.Owner
              ? String((r.Owner as { id?: string }).id || "") || null
              : null,
          customFields: {
            lastModifiedAt: r.Modified_Time ? String(r.Modified_Time) : null,
          },
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

  async findContactByEmail(ctx, email) {
    const data = await crmFetch<{ data?: Array<Record<string, unknown>> }>(
      `${apiBase(ctx)}/Contacts/search?email=${encodeURIComponent(email)}`,
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
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "contact",
      base: {
        id: contact.id || undefined,
        First_Name: contact.firstName,
        Last_Name: contact.lastName || "Unknown",
        Phone: contact.phone,
        Email: contact.email,
        Lead_Source: contact.source || "Transovo",
        Account_Name: contact.companyExternalId
          ? { id: contact.companyExternalId }
          : contact.companyName
            ? contact.companyName
            : undefined,
        Tag: contact.tags?.length ? contact.tags.map((name) => ({ name })) : undefined,
        Owner: contact.ownerExternalId
          ? { id: contact.ownerExternalId }
          : ctx.preferences.defaultOwnerExternalId
            ? { id: ctx.preferences.defaultOwnerExternalId }
            : undefined,
      },
      customFields: contact.customFields,
    });
    const body = { data: [fields] };
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

  async listLeads(ctx, cursor, opts) {
    if (isBigin(ctx)) {
      // Bigin has no native Leads module equivalent to Zoho CRM Leads.
      return { items: [], nextCursor: null };
    }
    const page = cursor ? Number(cursor) : 1;
    let path = `${apiBase(ctx)}/Leads?page=${page}&per_page=200`;
    if (opts?.modifiedSince) {
      const criteria = encodeURIComponent(
        `(Modified_Time:greater_equal:${opts.modifiedSince.toISOString()})`,
      );
      path = `${apiBase(ctx)}/Leads/search?criteria=${criteria}&page=${page}&per_page=200`;
    }
    const data = await crmFetch<{ data?: Array<Record<string, unknown>>; info?: { more_records?: boolean } }>(
      path,
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
    if (isBigin(ctx)) {
      throw new Error("Bigin does not support Zoho CRM Leads — use Contacts/Pipelines");
    }
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "lead",
      base: {
        id: lead.id || undefined,
        First_Name: lead.firstName,
        Last_Name: lead.lastName || "Unknown",
        Phone: lead.phone,
        Email: lead.email,
        Company: lead.companyName || "Unknown",
        Lead_Source: lead.source || "Transovo",
        Lead_Status: lead.status || undefined,
      },
      customFields: lead.customFields,
    });
    const body = { data: [fields] };
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

  async listDeals(ctx, cursor, opts) {
    const page = cursor ? Number(cursor) : 1;
    // Bigin pipeline records use Pipelines module; Zoho CRM uses Deals.
    const module = isBigin(ctx) ? "Pipelines" : "Deals";
    let path = `${apiBase(ctx)}/${module}?page=${page}&per_page=200`;
    if (opts?.modifiedSince) {
      const criteria = encodeURIComponent(
        `(Modified_Time:greater_equal:${opts.modifiedSince.toISOString()})`,
      );
      path = `${apiBase(ctx)}/${module}/search?criteria=${criteria}&page=${page}&per_page=200`;
    }
    const data = await crmFetch<{ data?: Array<Record<string, unknown>>; info?: { more_records?: boolean } }>(
      path,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.data || []).map(
        (r): CrmDeal => ({
          id: String(r.id),
          name: String(r.Deal_Name || r.Pipeline_Name || r.Name || "Deal"),
          amount: r.Amount != null ? Number(r.Amount) : null,
          stage: (r.Stage as string) || null,
          pipeline: (r.Pipeline as string) || null,
          closeDate: (r.Closing_Date as string) || null,
        }),
      ),
      nextCursor: data.info?.more_records ? String(page + 1) : null,
    };
  },

  async upsertDeal(ctx, deal) {
    const module = isBigin(ctx) ? "Pipelines" : "Deals";
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "deal",
      base: {
        id: deal.id || undefined,
        Deal_Name: deal.name,
        Amount: deal.amount,
        Stage: deal.stage,
        Pipeline: deal.pipeline,
        Closing_Date: deal.closeDate || undefined,
      },
      customFields: deal.customFields,
    });
    const body = { data: [fields] };
    if (deal.id) {
      await crmFetch(`${apiBase(ctx)}/${module}`, {
        method: "PUT",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: deal.id, created: false };
    }
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/${module}`,
      { method: "POST", accessToken: ctx.accessToken, body: JSON.stringify(body) },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho/Bigin deal create failed");
    return { externalId: id, created: true };
  },

  async createTask(ctx, task) {
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "task",
      base: {
        Subject: task.subject,
        Description: task.description,
        Due_Date: task.dueAt ? task.dueAt.slice(0, 10) : undefined,
        Status: task.status || "Not Started",
        Who_Id: task.contactExternalId || undefined,
      },
      customFields: task.customFields,
    });
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Tasks`,
      {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify({ data: [fields] }),
      },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho task create failed");
    return { externalId: id, created: true };
  },

  async createNote(ctx, note) {
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "note",
      base: {
        Note_Title: "Transovo note",
        Note_Content: note.body,
        Parent_Id: note.contactExternalId || undefined,
        se_module: "Contacts",
      },
      customFields: note.customFields,
    });
    const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
      `${apiBase(ctx)}/Notes`,
      {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify({ data: [fields] }),
      },
    );
    const id = created.data?.[0]?.details?.id;
    if (!id) throw new Error("Zoho note create failed");
    return { externalId: id, created: true };
  },

  async updateNote(ctx, note) {
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "note",
      base: {
        id: note.id,
        Note_Title: "Transovo note",
        Note_Content: note.body,
        Parent_Id: note.contactExternalId || undefined,
        se_module: "Contacts",
      },
      customFields: note.customFields,
    });
    await crmFetch(`${apiBase(ctx)}/Notes`, {
      method: "PUT",
      accessToken: ctx.accessToken,
      body: JSON.stringify({ data: [fields] }),
    });
    return { externalId: note.id, created: false };
  },

  async listTasks(ctx, cursor, opts) {
    const page = cursor ? Number(cursor) : 1;
    let path = `${apiBase(ctx)}/Tasks?page=${page}&per_page=200`;
    if (opts?.modifiedSince) {
      const criteria = encodeURIComponent(
        `(Modified_Time:greater_equal:${opts.modifiedSince.toISOString()})`,
      );
      path = `${apiBase(ctx)}/Tasks/search?criteria=${criteria}&page=${page}&per_page=200`;
    }
    const data = await crmFetch<{
      data?: Array<Record<string, unknown>>;
      info?: { more_records?: boolean };
    }>(path, { accessToken: ctx.accessToken });
    return {
      items: (data.data || []).map(
        (r): CrmTask => ({
          id: String(r.id),
          subject: String(r.Subject || "Task"),
          description: (r.Description as string) || null,
          status: (r.Status as string) || null,
          dueAt: (r.Due_Date as string) || null,
          contactExternalId:
            typeof r.Who_Id === "object" && r.Who_Id
              ? String((r.Who_Id as { id?: string }).id || "") || null
              : null,
        }),
      ),
      nextCursor: data.info?.more_records ? String(page + 1) : null,
    };
  },

  async listNotes(ctx, cursor) {
    const page = cursor ? Number(cursor) : 1;
    const data = await crmFetch<{
      data?: Array<Record<string, unknown>>;
      info?: { more_records?: boolean };
    }>(`${apiBase(ctx)}/Notes?page=${page}&per_page=200`, { accessToken: ctx.accessToken });
    return {
      items: (data.data || []).map((r) => ({
        id: String(r.id),
        body: String(r.Note_Content || r.Note_Title || ""),
        contactExternalId:
          typeof r.Parent_Id === "object" && r.Parent_Id
            ? String((r.Parent_Id as { id?: string }).id || "") || null
            : null,
        updatedAt: (r.Modified_Time as string) || null,
      })),
      nextCursor: data.info?.more_records ? String(page + 1) : null,
    };
  },

  async listActivities(ctx, cursor, opts) {
    // Prefer Calls module as communication activities; fall back to Tasks page.
    try {
      const page = cursor ? Number(cursor) : 1;
      const data = await crmFetch<{
        data?: Array<Record<string, unknown>>;
        info?: { more_records?: boolean };
      }>(`${apiBase(ctx)}/Calls?page=${page}&per_page=200`, { accessToken: ctx.accessToken });
      return {
        items: (data.data || []).map((r) => ({
          id: String(r.id),
          type: "call" as const,
          subject: String(r.Subject || "Call"),
          body: (r.Description as string) || null,
          status: (r.Call_Status as string) || null,
          startedAt: (r.Call_Start_Time as string) || null,
          contactExternalId:
            typeof r.Who_Id === "object" && r.Who_Id
              ? String((r.Who_Id as { id?: string }).id || "") || null
              : null,
          updatedAt: (r.Modified_Time as string) || null,
        })),
        nextCursor: data.info?.more_records ? String(page + 1) : null,
      };
    } catch {
      const tasks = await zohoConnector.listTasks!(ctx, cursor, opts);
      return {
        items: tasks.items.map((t) => ({
          id: t.id,
          type: "task" as const,
          subject: t.subject,
          body: t.description,
          status: t.status,
          dueAt: t.dueAt,
          contactExternalId: t.contactExternalId,
        })),
        nextCursor: tasks.nextCursor,
      };
    }
  },

  async logCall(ctx, call) {
    const description = [
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

    const callType =
      call.direction === "missed"
        ? "Missed"
        : call.direction === "outbound"
          ? "Outbound"
          : "Inbound";

    const record = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "call",
      base: {
        Subject: call.subject || `${callType} call via Transovo`,
        Call_Type: callType,
        Call_Start_Time: call.startedAt || new Date().toISOString(),
        Call_Duration: call.durationSeconds != null ? String(call.durationSeconds) : undefined,
        Call_Result: call.disposition || undefined,
        Description: description,
        Who_Id: call.contactExternalId ? { id: call.contactExternalId } : undefined,
        Owner: ctx.preferences.defaultOwnerExternalId
          ? { id: ctx.preferences.defaultOwnerExternalId }
          : undefined,
      },
      customFields: {
        disposition: call.disposition,
        ...(call.customFields || {}),
      },
    });
    if (call.id) record.id = call.id;

    try {
      if (call.id) {
        await crmFetch(`${apiBase(ctx)}/Calls`, {
          method: "PUT",
          accessToken: ctx.accessToken,
          body: JSON.stringify({ data: [record] }),
        });
        return { externalId: call.id, created: false };
      }
      const created = await crmFetch<{ data?: Array<{ details?: { id?: string } }> }>(
        `${apiBase(ctx)}/Calls`,
        {
          method: "POST",
          accessToken: ctx.accessToken,
          body: JSON.stringify({ data: [record] }),
        },
      );
      const id = created.data?.[0]?.details?.id;
      if (!id) throw new Error("Zoho Calls create failed");
      return { externalId: id, created: true };
    } catch {
      // Fallback when Calls module unavailable on plan
      if (call.id && zohoConnector.updateTask) {
        return zohoConnector.updateTask(ctx, {
          id: call.id,
          subject: String(record.Subject),
          description,
          status: "Completed",
          contactExternalId: call.contactExternalId,
          dueAt: call.startedAt,
        });
      }
      return zohoConnector.createTask!(ctx, {
        subject: String(record.Subject),
        description,
        status: "Completed",
        contactExternalId: call.contactExternalId,
        dueAt: call.startedAt,
      });
    }
  },

  async updateTask(ctx, task) {
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "task",
      base: {
        id: task.id,
        Subject: task.subject,
        Description: task.description,
        Status: task.status,
        Due_Date: task.dueAt,
        What_Id: task.contactExternalId
          ? { id: task.contactExternalId }
          : undefined,
      },
      customFields: task.customFields,
    });
    await crmFetch(`${apiBase(ctx)}/Tasks`, {
      method: "PUT",
      accessToken: ctx.accessToken,
      body: JSON.stringify({ data: [fields] }),
    });
    return { externalId: task.id, created: false };
  },

  async logSms(ctx, sms) {
    const description = [
      sms.body || "",
      sms.mediaUrls?.length ? `Media: ${sms.mediaUrls.join(", ")}` : null,
      sms.status ? `Status: ${sms.status}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const customFields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "sms",
      base: {
        subject: `${sms.direction} SMS via Transovo`,
        description,
        status: "Completed",
      },
      customFields: sms.customFields,
    });
    if (sms.id && zohoConnector.updateTask) {
      return zohoConnector.updateTask(ctx, {
        id: sms.id,
        subject: String(customFields.subject || `${sms.direction} SMS via Transovo`),
        description: String(customFields.description || description),
        status: "Completed",
        contactExternalId: sms.contactExternalId,
        dueAt: sms.sentAt,
        customFields,
      });
    }
    return zohoConnector.createTask!(ctx, {
      subject: String(customFields.subject || `${sms.direction} SMS via Transovo`),
      description: String(customFields.description || description),
      status: "Completed",
      contactExternalId: sms.contactExternalId,
      dueAt: sms.sentAt,
      customFields,
    });
  },

  async listCompanies(ctx, cursor, opts) {
    const page = cursor ? Number(cursor) : 1;
    let path = `${apiBase(ctx)}/Accounts?page=${page}&per_page=200`;
    if (opts?.modifiedSince) {
      const criteria = encodeURIComponent(
        `(Modified_Time:greater_equal:${opts.modifiedSince.toISOString()})`,
      );
      path = `${apiBase(ctx)}/Accounts/search?criteria=${criteria}&page=${page}&per_page=200`;
    }
    const data = await crmFetch<{
      data?: Array<Record<string, unknown>>;
      info?: { more_records?: boolean };
    }>(path, {
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
    const fields = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "zoho",
      objectType: "company",
      base: {
        id: company.id || undefined,
        Account_Name: company.name,
        Phone: company.phone,
        Website: company.website,
      },
      customFields: company.customFields,
    });
    const body = { data: [fields] };
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
    const module = isBigin(ctx) ? "Pipelines" : "Deals";
    try {
      const data = await crmFetch<{
        fields?: Array<{
          api_name?: string;
          pick_list_values?: Array<{ display_value?: string; actual_value?: string }>;
        }>;
      }>(`${apiBase(ctx)}/settings/fields?module=${module}`, { accessToken: ctx.accessToken });
      const stage = data.fields?.find((f) => f.api_name === "Stage");
      const stages = (stage?.pick_list_values || []).map((p, i) => ({
        id: String(p.actual_value || p.display_value || i),
        name: String(p.display_value || p.actual_value || "Stage"),
        order: i,
      }));
      return [{ id: module.toLowerCase(), name: module, stages }];
    } catch {
      // INTENTIONAL: org may lack Stage picklist metadata — soft-empty, not a stub write path.
      return [];
    }
  },

  async listTags(ctx) {
    // Zoho tags are module-attached; expose from Contacts Tag field when available.
    try {
      const data = await crmFetch<{
        tags?: Array<{ name?: string; id?: string; colour_code?: string }>;
      }>(`${apiBase(ctx)}/settings/tags?module=Contacts`, { accessToken: ctx.accessToken });
      return (data.tags || []).map((t) => ({
        id: t.id ? String(t.id) : undefined,
        name: String(t.name || ""),
        color: t.colour_code || null,
      })).filter((t) => t.name);
    } catch {
      // INTENTIONAL: tags API unavailable on some Zoho/Bigin editions.
      return [];
    }
  },

  async handleWebhook(_ctx, _headers, body) {
    const payload = (body || {}) as Record<string, unknown>;
    const events = Array.isArray(payload) ? payload : [payload];
    return {
      accepted: true,
      events: events.map((e) => (typeof e === "object" && e ? (e as Record<string, unknown>) : {})),
    };
  },
};
