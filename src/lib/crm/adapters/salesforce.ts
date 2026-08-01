/**
 * Salesforce CRM adapter — thin translation layer over the CRM framework.
 */

import type { CrmConnector, ConnectorContext, ListPage, UpsertResult } from "../connector";
import { crmFetch } from "../http";
import { scopesForProvider } from "../scopes";
import type {
  CrmCallActivity,
  CrmCompany,
  CrmContact,
  CrmDeal,
  CrmLead,
  CrmNote,
  CrmPipeline,
  CrmSmsActivity,
  CrmTask,
  CrmUser,
  OAuthProviderConfig,
} from "../types";

function instanceUrl(ctx: ConnectorContext) {
  const url = String(ctx.meta.instanceUrl || "").replace(/\/$/, "");
  if (!url) throw new Error("Salesforce instanceUrl missing — reconnect OAuth");
  return url;
}

function api(ctx: ConnectorContext, path: string) {
  return `${instanceUrl(ctx)}/services/data/v59.0${path}`;
}

export const salesforceConnector: CrmConnector = {
  id: "salesforce",
  displayName: "Salesforce",
  oauth: {
    authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize",
    tokenUrl: "https://login.salesforce.com/services/oauth2/token",
    scopes: scopesForProvider("salesforce"),
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
    authorizeParams: { prompt: "login consent" },
  } satisfies OAuthProviderConfig,

  parseTokenResponse(json) {
    const expiresIn = Number(json.expires_in || 7200);
    return {
      accessToken: String(json.access_token || ""),
      refreshToken: json.refresh_token ? String(json.refresh_token) : null,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      externalId: json.id ? String(json.id) : null,
      meta: {
        instanceUrl: json.instance_url ? String(json.instance_url) : undefined,
        issuedAt: json.issued_at ? String(json.issued_at) : undefined,
        tokenType: json.token_type ? String(json.token_type) : undefined,
      },
    };
  },

  async validateConnection(ctx) {
    try {
      const identity = await crmFetch<{ user_id?: string; display_name?: string; organization_id?: string }>(
        `${instanceUrl(ctx)}/services/oauth2/userinfo`,
        { accessToken: ctx.accessToken },
      );
      return {
        ok: true,
        state: "connected",
        externalAccountId: identity.organization_id || identity.user_id || null,
        externalAccountName: identity.display_name || null,
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
    const soql =
      "SELECT Id, FirstName, LastName, Phone, MobilePhone, Email, Account.Name, OwnerId FROM Contact ORDER BY LastModifiedDate DESC LIMIT 200";
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    const data = await crmFetch<{
      records?: Array<Record<string, unknown>>;
      nextRecordsUrl?: string;
    }>(url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`, {
      accessToken: ctx.accessToken,
    });
    const items: CrmContact[] = (data.records || []).map((r) => ({
      id: String(r.Id),
      firstName: (r.FirstName as string) || null,
      lastName: (r.LastName as string) || null,
      phone: (r.Phone as string) || (r.MobilePhone as string) || null,
      email: (r.Email as string) || null,
      companyName: (r.Account as { Name?: string } | null)?.Name || null,
      ownerExternalId: (r.OwnerId as string) || null,
    }));
    return {
      items,
      nextCursor: data.nextRecordsUrl
        ? data.nextRecordsUrl.startsWith("http")
          ? data.nextRecordsUrl
          : `${instanceUrl(ctx)}${data.nextRecordsUrl}`
        : null,
    } satisfies ListPage<CrmContact>;
  },

  async findContactByPhone(ctx, phone) {
    const digits = phone.replace(/\D/g, "");
    const soql = `SELECT Id, FirstName, LastName, Phone, MobilePhone, Email FROM Contact WHERE Phone LIKE '%${digits.slice(-10)}%' OR MobilePhone LIKE '%${digits.slice(-10)}%' LIMIT 1`;
    const data = await crmFetch<{ records?: Array<Record<string, unknown>> }>(
      `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`,
      { accessToken: ctx.accessToken },
    );
    const r = data.records?.[0];
    if (!r) return null;
    return {
      id: String(r.Id),
      firstName: (r.FirstName as string) || null,
      lastName: (r.LastName as string) || null,
      phone: (r.Phone as string) || (r.MobilePhone as string) || null,
      email: (r.Email as string) || null,
    };
  },

  async upsertContact(ctx, contact) {
    if (contact.id) {
      await crmFetch(api(ctx, `/sobjects/Contact/${contact.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          FirstName: contact.firstName,
          LastName: contact.lastName || "Unknown",
          Phone: contact.phone,
          Email: contact.email,
        }),
      });
      return { externalId: contact.id, created: false, externalUrl: `${instanceUrl(ctx)}/${contact.id}` };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Contact"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({
        FirstName: contact.firstName,
        LastName: contact.lastName || "Unknown",
        Phone: contact.phone,
        Email: contact.email,
        LeadSource: contact.source || "Transovo",
      }),
    });
    return {
      externalId: created.id,
      created: true,
      externalUrl: `${instanceUrl(ctx)}/${created.id}`,
    };
  },

  async listLeads(ctx, cursor) {
    const soql =
      "SELECT Id, FirstName, LastName, Phone, Email, Company, Status, LeadSource, OwnerId FROM Lead ORDER BY LastModifiedDate DESC LIMIT 200";
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    const data = await crmFetch<{ records?: Array<Record<string, unknown>>; nextRecordsUrl?: string }>(
      url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.records || []).map(
        (r): CrmLead => ({
          id: String(r.Id),
          firstName: (r.FirstName as string) || null,
          lastName: (r.LastName as string) || null,
          phone: (r.Phone as string) || null,
          email: (r.Email as string) || null,
          companyName: (r.Company as string) || null,
          status: (r.Status as string) || null,
          source: (r.LeadSource as string) || null,
          ownerExternalId: (r.OwnerId as string) || null,
        }),
      ),
      nextCursor: data.nextRecordsUrl
        ? data.nextRecordsUrl.startsWith("http")
          ? data.nextRecordsUrl
          : `${instanceUrl(ctx)}${data.nextRecordsUrl}`
        : null,
    };
  },

  async upsertLead(ctx, lead) {
    if (lead.id) {
      await crmFetch(api(ctx, `/sobjects/Lead/${lead.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          FirstName: lead.firstName,
          LastName: lead.lastName || "Unknown",
          Phone: lead.phone,
          Email: lead.email,
          Company: lead.companyName || "Unknown",
        }),
      });
      return { externalId: lead.id, created: false };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Lead"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({
        FirstName: lead.firstName,
        LastName: lead.lastName || "Unknown",
        Phone: lead.phone,
        Email: lead.email,
        Company: lead.companyName || "Unknown",
        LeadSource: lead.source || "Transovo",
      }),
    });
    return { externalId: created.id, created: true };
  },

  async listDeals(ctx, cursor) {
    const soql =
      "SELECT Id, Name, Amount, StageName, AccountId, OwnerId, IsClosed FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 200";
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    const data = await crmFetch<{ records?: Array<Record<string, unknown>>; nextRecordsUrl?: string }>(
      url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.records || []).map(
        (r): CrmDeal => ({
          id: String(r.Id),
          name: String(r.Name || "Opportunity"),
          amount: r.Amount != null ? Number(r.Amount) : null,
          stage: (r.StageName as string) || null,
          companyExternalId: (r.AccountId as string) || null,
          ownerExternalId: (r.OwnerId as string) || null,
          status: r.IsClosed ? "closed" : "open",
        }),
      ),
      nextCursor: data.nextRecordsUrl || null,
    };
  },

  async upsertDeal(ctx, deal) {
    if (deal.id) {
      await crmFetch(api(ctx, `/sobjects/Opportunity/${deal.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          Name: deal.name,
          Amount: deal.amount,
          StageName: deal.stage,
        }),
      });
      return { externalId: deal.id, created: false };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Opportunity"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({
        Name: deal.name,
        Amount: deal.amount,
        StageName: deal.stage || "Prospecting",
        CloseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      }),
    });
    return { externalId: created.id, created: true };
  },

  async createTask(ctx, task) {
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({
        Subject: task.subject,
        Description: task.description,
        Status: task.status || "Not Started",
        Priority: task.priority || "Normal",
        ActivityDate: task.dueAt ? task.dueAt.slice(0, 10) : undefined,
        WhoId: task.contactExternalId || undefined,
        OwnerId: task.ownerExternalId || ctx.preferences.defaultOwnerExternalId || undefined,
      }),
    });
    return { externalId: created.id, created: true };
  },

  async createNote(ctx, note) {
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/ContentNote"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({
        Title: "Transovo note",
        Content: Buffer.from(note.body).toString("base64"),
      }),
    }).catch(async () => {
      // Fallback: Task as note when ContentNote unavailable.
      return crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          Subject: "Transovo note",
          Description: note.body,
          Status: "Completed",
          WhoId: note.contactExternalId || undefined,
        }),
      });
    });
    return { externalId: created.id, created: true };
  },

  async logCall(ctx, call) {
    const subject =
      call.subject ||
      `${call.direction === "missed" ? "Missed" : call.direction === "inbound" ? "Inbound" : "Outbound"} call via Transovo`;
    const description = [
      call.notes,
      call.disposition ? `Disposition: ${call.disposition}` : null,
      call.durationSeconds != null ? `Duration: ${call.durationSeconds}s` : null,
      call.recordingUrl && ctx.preferences.syncRecordings
        ? `Recording: ${call.recordingUrl}`
        : null,
      call.transcriptUrl && ctx.preferences.syncTranscripts
        ? `Transcript: ${call.transcriptUrl}`
        : null,
      call.aiSummary ? `AI summary: ${call.aiSummary}` : null,
      call.transcriptText && ctx.preferences.syncTranscripts
        ? `Transcript text:\n${call.transcriptText}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({
        Subject: subject,
        Description: description,
        Status: "Completed",
        TaskSubtype: "Call",
        CallType:
          call.direction === "inbound"
            ? "Inbound"
            : call.direction === "outbound"
              ? "Outbound"
              : undefined,
        CallDurationInSeconds: call.durationSeconds ?? undefined,
        WhoId: call.contactExternalId || undefined,
        ActivityDate: (call.startedAt || new Date().toISOString()).slice(0, 10),
      }),
    });
    return { externalId: created.id, created: true } satisfies UpsertResult;
  },

  async logSms(ctx, sms) {
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({
        Subject: `${sms.direction === "inbound" ? "Inbound" : "Outbound"} SMS via Transovo`,
        Description: [sms.body, sms.mediaUrls?.length ? `Media: ${sms.mediaUrls.join(", ")}` : null]
          .filter(Boolean)
          .join("\n"),
        Status: "Completed",
        WhoId: sms.contactExternalId || undefined,
        ActivityDate: (sms.sentAt || new Date().toISOString()).slice(0, 10),
      }),
    });
    return { externalId: created.id, created: true };
  },

  async listCompanies(ctx, cursor) {
    const soql =
      "SELECT Id, Name, Phone, Website, OwnerId FROM Account ORDER BY LastModifiedDate DESC LIMIT 200";
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    const data = await crmFetch<{ records?: Array<Record<string, unknown>>; nextRecordsUrl?: string }>(
      url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.records || []).map(
        (r): CrmCompany => ({
          id: String(r.Id),
          name: String(r.Name || "Account"),
          phone: (r.Phone as string) || null,
          website: (r.Website as string) || null,
          ownerExternalId: (r.OwnerId as string) || null,
        }),
      ),
      nextCursor: data.nextRecordsUrl
        ? data.nextRecordsUrl.startsWith("http")
          ? data.nextRecordsUrl
          : `${instanceUrl(ctx)}${data.nextRecordsUrl}`
        : null,
    };
  },

  async upsertCompany(ctx, company) {
    if (company.id) {
      await crmFetch(api(ctx, `/sobjects/Account/${company.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify({ Name: company.name, Phone: company.phone, Website: company.website }),
      });
      return { externalId: company.id, created: false };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Account"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify({ Name: company.name, Phone: company.phone, Website: company.website }),
    });
    return { externalId: created.id, created: true };
  },

  async listUsers(ctx) {
    const soql = "SELECT Id, Name, Email FROM User WHERE IsActive = true LIMIT 200";
    const data = await crmFetch<{ records?: Array<Record<string, unknown>> }>(
      `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`,
      { accessToken: ctx.accessToken },
    );
    return (data.records || []).map(
      (r): CrmUser => ({
        externalId: String(r.Id),
        name: (r.Name as string) || null,
        email: (r.Email as string) || null,
      }),
    );
  },

  async listPipelines(ctx) {
    // Salesforce uses Opportunity StageName picklist — expose as a single virtual pipeline.
    const data = await crmFetch<{
      records?: Array<{ Id?: string; ApiName?: string; MasterLabel?: string; SortOrder?: number }>;
    }>(
      `${api(ctx, "/query")}?q=${encodeURIComponent(
        "SELECT Id, ApiName, MasterLabel, SortOrder FROM OpportunityStage WHERE IsActive = true ORDER BY SortOrder",
      )}`,
      { accessToken: ctx.accessToken },
    ).catch(async () => {
      const describe = await crmFetch<{
        fields?: Array<{ name?: string; picklistValues?: Array<{ value: string; label: string }> }>;
      }>(api(ctx, "/sobjects/Opportunity/describe"), { accessToken: ctx.accessToken });
      const stage = describe.fields?.find((f) => f.name === "StageName");
      return {
        records: (stage?.picklistValues || []).map((p, i) => ({
          ApiName: p.value,
          MasterLabel: p.label,
          SortOrder: i,
        })),
      };
    });
    return [
      {
        id: "opportunity",
        name: "Opportunity",
        stages: (data.records || []).map((r) => {
          const row = r as {
            Id?: string;
            ApiName?: string;
            MasterLabel?: string;
            SortOrder?: number;
          };
          return {
            id: String(row.ApiName || row.MasterLabel || row.Id),
            name: String(row.MasterLabel || row.ApiName || "Stage"),
            order: row.SortOrder != null ? Number(row.SortOrder) : undefined,
          };
        }),
      } satisfies CrmPipeline,
    ];
  },

  async listFields(ctx) {
    const out: Array<{ objectType: string; name: string; label: string }> = [];
    for (const objectType of ["Contact", "Lead", "Task"] as const) {
      try {
        const describe = await crmFetch<{
          fields?: Array<{ name?: string; label?: string; custom?: boolean; updateable?: boolean }>;
        }>(api(ctx, `/sobjects/${objectType}/describe`), { accessToken: ctx.accessToken });
        for (const f of describe.fields || []) {
          if (!f.name || f.updateable === false) continue;
          out.push({
            objectType: objectType.toLowerCase(),
            name: f.name,
            label: f.label || f.name,
          });
        }
      } catch {
        // continue other objects
      }
    }
    return out.slice(0, 400);
  },
};
