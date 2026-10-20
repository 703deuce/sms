/**
 * Salesforce CRM adapter — thin translation layer over the CRM framework.
 */

import type { CrmConnector, ConnectorContext, ListPage, UpsertResult } from "../connector";
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
  CrmPipeline,
  CrmSmsActivity,
  CrmTask,
  CrmUser,
  OAuthProviderConfig,
} from "../types";

function soqlDate(d: Date) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

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
    // Salesforce External Client Apps commonly require PKCE ("missing required code challenge").
    requiresPkce: true,
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
      const identity = await crmFetch<{
        user_id?: string;
        display_name?: string;
        organization_id?: string;
        preferred_username?: string;
      }>(`${instanceUrl(ctx)}/services/oauth2/userinfo`, {
        accessToken: ctx.accessToken,
      });
      const organizationId = identity.organization_id || null;
      const userId = identity.user_id || null;
      return {
        ok: true,
        state: "connected",
        // Organization is the connected Salesforce account; user is stored separately.
        externalAccountId: organizationId || userId,
        externalAccountName:
          identity.display_name || identity.preferred_username || null,
        details: {
          organizationId,
          userId,
          instanceUrl: instanceUrl(ctx),
          apiVersion: "v59.0",
        },
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
    const since = opts?.modifiedSince
      ? ` WHERE LastModifiedDate > ${soqlDate(opts.modifiedSince)}`
      : "";
    const soql = `SELECT Id, FirstName, LastName, Phone, MobilePhone, Email, Account.Name, OwnerId, LastModifiedDate FROM Contact${since} ORDER BY LastModifiedDate DESC LIMIT 200`;
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
      customFields: {
        lastModifiedAt: r.LastModifiedDate ? String(r.LastModifiedDate) : null,
      },
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

  async findContactByEmail(ctx, email) {
    const safe = email.replace(/'/g, "\\'");
    const soql = `SELECT Id, FirstName, LastName, Phone, MobilePhone, Email FROM Contact WHERE Email = '${safe}' LIMIT 1`;
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
    const isUpdate = Boolean(contact.id);
    // Partial updates must not invent LastName/LeadSource — that corrupts CRM data.
    const base: Record<string, unknown> = {
      FirstName: contact.firstName,
      Phone: contact.phone,
      Email: contact.email,
      AccountId: contact.companyExternalId || undefined,
      OwnerId:
        contact.ownerExternalId ||
        (!isUpdate ? ctx.preferences.defaultOwnerExternalId : undefined) ||
        undefined,
    };
    if (contact.lastName != null && contact.lastName !== "") {
      base.LastName = contact.lastName;
    } else if (!isUpdate) {
      base.LastName = "Unknown";
    }
    if (contact.source) {
      base.LeadSource = contact.source;
    } else if (!isUpdate) {
      base.LeadSource = "Transovo";
    }
    if (contact.status) {
      // Contact status is not a standard SF field — pass via customFields if mapped.
      // Intentionally not written to a wrong API field.
    }
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "contact",
      base,
      customFields: contact.customFields,
    });
    if (contact.id) {
      await crmFetch(api(ctx, `/sobjects/Contact/${contact.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: contact.id, created: false, externalUrl: `${instanceUrl(ctx)}/${contact.id}` };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Contact"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
    });
    return {
      externalId: created.id,
      created: true,
      externalUrl: `${instanceUrl(ctx)}/${created.id}`,
    };
  },

  async listLeads(ctx, cursor, opts) {
    const since = opts?.modifiedSince
      ? ` WHERE LastModifiedDate > ${soqlDate(opts.modifiedSince)}`
      : "";
    const soql = `SELECT Id, FirstName, LastName, Phone, Email, Company, Status, LeadSource, OwnerId FROM Lead${since} ORDER BY LastModifiedDate DESC LIMIT 200`;
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
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "lead",
      base: {
        FirstName: lead.firstName,
        LastName: lead.lastName || "Unknown",
        Phone: lead.phone,
        Email: lead.email,
        Company: lead.companyName || "Unknown",
        LeadSource: lead.source || "Transovo",
        Status: lead.status || undefined,
        OwnerId: lead.ownerExternalId || ctx.preferences.defaultOwnerExternalId || undefined,
      },
      customFields: lead.customFields,
    });
    if (lead.id) {
      await crmFetch(api(ctx, `/sobjects/Lead/${lead.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: lead.id, created: false };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Lead"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
    });
    return { externalId: created.id, created: true };
  },

  async listDeals(ctx, cursor, opts) {
    const since = opts?.modifiedSince
      ? ` WHERE LastModifiedDate > ${soqlDate(opts.modifiedSince)}`
      : "";
    // Include IsWon + primary OpportunityContactRole so deal.won/lost automations can link a contact.
    const soql = `SELECT Id, Name, Amount, StageName, AccountId, OwnerId, IsClosed, IsWon, CloseDate, LastModifiedDate, (SELECT ContactId FROM OpportunityContactRoles ORDER BY IsPrimary DESC NULLS LAST LIMIT 1) FROM Opportunity${since} ORDER BY LastModifiedDate DESC LIMIT 200`;
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    const data = await crmFetch<{ records?: Array<Record<string, unknown>>; nextRecordsUrl?: string }>(
      url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.records || []).map((r): CrmDeal => {
        const roles = (r.OpportunityContactRoles as { records?: Array<{ ContactId?: string }> } | null)
          ?.records;
        const contactId = roles?.[0]?.ContactId || null;
        const isWon = Boolean(r.IsWon);
        const isClosed = Boolean(r.IsClosed);
        return {
          id: String(r.Id),
          name: String(r.Name || "Opportunity"),
          amount: r.Amount != null ? Number(r.Amount) : null,
          stage: (r.StageName as string) || null,
          companyExternalId: (r.AccountId as string) || null,
          contactExternalId: contactId,
          ownerExternalId: (r.OwnerId as string) || null,
          closeDate: (r.CloseDate as string) || null,
          status: isWon ? "won" : isClosed ? "lost" : "open",
        };
      }),
      nextCursor: data.nextRecordsUrl || null,
    };
  },

  async upsertDeal(ctx, deal) {
    const isUpdate = Boolean(deal.id);
    // Map normalized won/lost/open onto Salesforce StageName when stage is omitted.
    let stage = deal.stage || null;
    if (!stage && deal.status) {
      const s = String(deal.status).toLowerCase();
      if (s === "won" || s.includes("closed won")) stage = "Closed Won";
      else if (s === "lost" || s.includes("closed lost")) stage = "Closed Lost";
      else if (s === "open" || s === "reopen" || s === "reopened") stage = "Prospecting";
    }
    const base: Record<string, unknown> = {
      Amount: deal.amount,
      AccountId: deal.companyExternalId || undefined,
      OwnerId:
        deal.ownerExternalId ||
        (!isUpdate ? ctx.preferences.defaultOwnerExternalId : undefined) ||
        undefined,
    };
    // Never invent Name/Stage/CloseDate on PATCH — that resets live opportunities.
    if (deal.name) base.Name = deal.name;
    else if (!isUpdate) base.Name = "Opportunity";
    if (stage) base.StageName = stage;
    else if (!isUpdate) base.StageName = "Prospecting";
    if (deal.closeDate) base.CloseDate = deal.closeDate;
    else if (!isUpdate) {
      base.CloseDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    }
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "deal",
      base,
      customFields: deal.customFields,
    });
    if (deal.id) {
      await crmFetch(api(ctx, `/sobjects/Opportunity/${deal.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: deal.id, created: false };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Opportunity"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
    });
    return { externalId: created.id, created: true };
  },

  async createTask(ctx, task) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "task",
      base: {
        Subject: task.subject,
        Description: task.description,
        Status: task.status || "Not Started",
        Priority: task.priority || "Normal",
        ActivityDate: task.dueAt ? task.dueAt.slice(0, 10) : undefined,
        WhoId: task.contactExternalId || undefined,
        OwnerId: task.ownerExternalId || ctx.preferences.defaultOwnerExternalId || undefined,
      },
      customFields: task.customFields,
    });
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
    });
    return { externalId: created.id, created: true };
  },

  async createNote(ctx, note) {
    const linkTo = note.relatedExternalId || note.contactExternalId || null;
    try {
      const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/ContentNote"), {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          Title: "Transovo note",
          Content: Buffer.from(note.body, "utf8").toString("base64"),
        }),
      });
      if (linkTo) {
        // ContentNote Id is also the ContentDocument Id for linking in modern orgs;
        // if link fails, resolve LatestPublishedVersion → ContentDocumentId.
        let documentId = created.id;
        const linked = await crmFetch(api(ctx, "/sobjects/ContentDocumentLink"), {
          method: "POST",
          accessToken: ctx.accessToken,
          body: JSON.stringify({
            ContentDocumentId: documentId,
            LinkedEntityId: linkTo,
            ShareType: "V",
          }),
        }).catch(() => null);
        if (!linked) {
          const resolved = await crmFetch<{
            records?: Array<{ ContentDocumentId?: string }>;
          }>(
            `${api(ctx, "/query")}?q=${encodeURIComponent(
              `SELECT ContentDocumentId FROM ContentVersion WHERE Id = '${created.id}' OR ContentDocumentId = '${created.id}' LIMIT 1`,
            )}`,
            { accessToken: ctx.accessToken },
          ).catch(() => ({ records: [] as Array<{ ContentDocumentId?: string }> }));
          documentId = resolved.records?.[0]?.ContentDocumentId || created.id;
          await crmFetch(api(ctx, "/sobjects/ContentDocumentLink"), {
            method: "POST",
            accessToken: ctx.accessToken,
            body: JSON.stringify({
              ContentDocumentId: documentId,
              LinkedEntityId: linkTo,
              ShareType: "V",
            }),
          }).catch(() => undefined);
        }
      }
      return { externalId: created.id, created: true };
    } catch {
      const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
        method: "POST",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          Subject: "Transovo note",
          Description: note.body,
          Status: "Completed",
          // WhoId is Contact/Lead; WhatId is Account/Opportunity/etc.
          WhoId:
            note.relatedType === "lead" || note.relatedType === "contact" || !note.relatedType
              ? linkTo || undefined
              : undefined,
          WhatId:
            note.relatedType === "deal" ||
            note.relatedType === "company" ||
            note.relatedType === "account"
              ? linkTo || undefined
              : undefined,
        }),
      });
      return { externalId: created.id, created: true };
    }
  },

  async updateTask(ctx, task) {
    let status = task.status || undefined;
    if (status && /^(completed|complete|done)$/i.test(status)) {
      status = "Completed";
    }
    const base: Record<string, unknown> = {
      Description: task.description,
      Status: status,
      ActivityDate: task.dueAt ? task.dueAt.slice(0, 10) : undefined,
      WhoId: task.contactExternalId || undefined,
      OwnerId: task.ownerExternalId || undefined,
    };
    // Omit Subject when the caller only wants status/owner/due changes.
    if (task.subject) base.Subject = task.subject;
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "task",
      base,
      customFields: task.customFields,
    });
    await crmFetch(api(ctx, `/sobjects/Task/${task.id}`), {
      method: "PATCH",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
    });
    return { externalId: task.id, created: false };
  },

  async updateNote(ctx, note) {
    try {
      await crmFetch(api(ctx, `/sobjects/ContentNote/${note.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          Title: "Transovo note",
          Content: Buffer.from(note.body, "utf8").toString("base64"),
        }),
      });
      return { externalId: note.id, created: false };
    } catch {
      await crmFetch(api(ctx, `/sobjects/Task/${note.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify({
          Subject: "Transovo note",
          Description: note.body,
          Status: "Completed",
          WhoId: note.contactExternalId || undefined,
        }),
      });
      return { externalId: note.id, created: false };
    }
  },

  async listTasks(ctx, cursor, opts) {
    const since = opts?.modifiedSince
      ? ` WHERE LastModifiedDate > ${soqlDate(opts.modifiedSince)}`
      : "";
    const soql = `SELECT Id, Subject, Description, Status, ActivityDate, WhoId, OwnerId, LastModifiedDate FROM Task${since} ORDER BY LastModifiedDate DESC LIMIT 200`;
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    const data = await crmFetch<{ records?: Array<Record<string, unknown>>; nextRecordsUrl?: string }>(
      url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.records || []).map(
        (r): CrmTask => ({
          id: String(r.Id),
          subject: String(r.Subject || "Task"),
          description: (r.Description as string) || null,
          status: (r.Status as string) || null,
          dueAt: (r.ActivityDate as string) || null,
          contactExternalId: (r.WhoId as string) || null,
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

  async listNotes(ctx, cursor) {
    const soql =
      "SELECT Id, Title, TextPreview, LastModifiedDate FROM ContentNote ORDER BY LastModifiedDate DESC LIMIT 100";
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    try {
      const data = await crmFetch<{
        records?: Array<Record<string, unknown>>;
        nextRecordsUrl?: string;
      }>(url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`, {
        accessToken: ctx.accessToken,
      });
      return {
        items: (data.records || []).map((r) => ({
          id: String(r.Id),
          body: String(r.TextPreview || r.Title || ""),
          updatedAt: (r.LastModifiedDate as string) || null,
        })),
        nextCursor: data.nextRecordsUrl
          ? data.nextRecordsUrl.startsWith("http")
            ? data.nextRecordsUrl
            : `${instanceUrl(ctx)}${data.nextRecordsUrl}`
          : null,
      };
    } catch {
      return { items: [], nextCursor: null };
    }
  },

  async listActivities(ctx, cursor, opts) {
    const since = opts?.modifiedSince
      ? ` WHERE LastModifiedDate > ${soqlDate(opts.modifiedSince)}`
      : "";
    const soql = `SELECT Id, Subject, Description, Status, ActivityDate, WhoId, TaskSubtype, LastModifiedDate FROM Task${since} ORDER BY LastModifiedDate DESC LIMIT 200`;
    const url = cursor || `${api(ctx, "/query")}?q=${encodeURIComponent(soql)}`;
    const data = await crmFetch<{ records?: Array<Record<string, unknown>>; nextRecordsUrl?: string }>(
      url.startsWith("http") ? url : `${instanceUrl(ctx)}${url}`,
      { accessToken: ctx.accessToken },
    );
    return {
      items: (data.records || []).map((r) => ({
        id: String(r.Id),
        type: String(r.TaskSubtype || "").toLowerCase() === "call" ? ("call" as const) : ("task" as const),
        subject: String(r.Subject || "Activity"),
        body: (r.Description as string) || null,
        status: (r.Status as string) || null,
        dueAt: (r.ActivityDate as string) || null,
        contactExternalId: (r.WhoId as string) || null,
        updatedAt: (r.LastModifiedDate as string) || null,
      })),
      nextCursor: data.nextRecordsUrl
        ? data.nextRecordsUrl.startsWith("http")
          ? data.nextRecordsUrl
          : `${instanceUrl(ctx)}${data.nextRecordsUrl}`
        : null,
    };
  },

  async listTags() {
    // INTENTIONAL: Salesforce has no universal Tags API across all orgs.
    // Feature matrix marks tags unsupported — empty list is correct, not a stub.
    return [];
  },

  // INTENTIONAL: no handleWebhook. CDC / Streaming / Pub-Sub is not subscribed.
  // Inbound `/api/crm/webhooks/salesforce` therefore falls through to incremental
  // reconcile sync (see processCrmWebhookJob). Do not fake CDC support here.

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
      call.aiSummary && ctx.preferences.syncAiSummary
        ? `AI summary: ${call.aiSummary}`
        : null,
      call.transcriptText && ctx.preferences.syncTranscripts
        ? `Transcript text:\n${call.transcriptText}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    // Disposition belongs in CallDisposition / Description only.
    // Passing `disposition` as a custom Task field causes INVALID_FIELD on Salesforce.
    const safeCustom = { ...(call.customFields || {}) };
    delete safeCustom.disposition;
    delete safeCustom.CallDisposition;

    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "call",
      base: {
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
        CallDisposition: call.disposition || undefined,
        WhoId: call.contactExternalId || undefined,
        ActivityDate: (call.startedAt || new Date().toISOString()).slice(0, 10),
      },
      customFields: safeCustom,
    });

    if (call.id) {
      await crmFetch(api(ctx, `/sobjects/Task/${call.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: call.id, created: false } satisfies UpsertResult;
    }

    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
    });
    return { externalId: created.id, created: true } satisfies UpsertResult;
  },

  async logSms(ctx, sms) {
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "sms",
      base: {
        Subject: `${sms.direction === "inbound" ? "Inbound" : "Outbound"} SMS via Transovo`,
        Description: [sms.body, sms.mediaUrls?.length ? `Media: ${sms.mediaUrls.join(", ")}` : null]
          .filter(Boolean)
          .join("\n"),
        Status: "Completed",
        WhoId: sms.contactExternalId || undefined,
        ActivityDate: (sms.sentAt || new Date().toISOString()).slice(0, 10),
      },
      customFields: sms.customFields,
    });
    if (sms.id) {
      await crmFetch(api(ctx, `/sobjects/Task/${sms.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: sms.id, created: false };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Task"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
    });
    return { externalId: created.id, created: true };
  },

  async listCompanies(ctx, cursor, opts) {
    const since = opts?.modifiedSince
      ? ` WHERE LastModifiedDate > ${soqlDate(opts.modifiedSince)}`
      : "";
    const soql = `SELECT Id, Name, Phone, Website, OwnerId, LastModifiedDate FROM Account${since} ORDER BY LastModifiedDate DESC LIMIT 200`;
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
    const isUpdate = Boolean(company.id);
    const base: Record<string, unknown> = {
      Phone: company.phone,
      Website: company.website,
      OwnerId:
        company.ownerExternalId ||
        (!isUpdate ? ctx.preferences.defaultOwnerExternalId : undefined) ||
        undefined,
    };
    if (company.name) base.Name = company.name;
    else if (!isUpdate) base.Name = "Account";
    const body = await buildMappedPayload({
      workspaceId: ctx.workspaceId,
      provider: "salesforce",
      objectType: "company",
      base,
      customFields: company.customFields,
    });
    if (company.id) {
      await crmFetch(api(ctx, `/sobjects/Account/${company.id}`), {
        method: "PATCH",
        accessToken: ctx.accessToken,
        body: JSON.stringify(body),
      });
      return { externalId: company.id, created: false };
    }
    const created = await crmFetch<{ id: string }>(api(ctx, "/sobjects/Account"), {
      method: "POST",
      accessToken: ctx.accessToken,
      body: JSON.stringify(body),
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
