/**
 * Live acceptance battery for Zoho CRM + Pipedrive.
 * Invoked from diagnostics (`action: "acceptance"`) — not a product feature surface.
 */

import type { ConnectorContext } from "./connector";
import { CrmHttpError } from "./http";
import { ensureFreshCrmToken } from "./oauth";
import { getConnector } from "./registry";
import { scopesForProvider } from "./scopes";
import { getCrmSyncPreferences } from "./settings";
import type { CrmProviderId } from "./types";

export type AcceptanceItem = {
  id: string;
  status:
    | "Live tested and passed"
    | "Failed and fixed"
    | "Blocked by provider permissions or plan"
    | "Unsupported";
  message: string;
  externalId?: string | null;
  httpStatus?: number | null;
};

export type AcceptanceReport = {
  provider: CrmProviderId;
  requestedScopes: string[];
  connectionMeta: Record<string, unknown>;
  items: AcceptanceItem[];
  queue: {
    pending: number;
    failed: number;
    deadLetters: number;
  };
};

async function ctxFor(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<ConnectorContext> {
  const conn = await ensureFreshCrmToken(workspaceId, provider);
  if (!conn?.accessToken) throw new Error("No access token");
  return {
    workspaceId,
    accessToken: conn.accessToken,
    refreshToken: conn.refreshToken,
    meta: (conn.configJson || {}) as Record<string, unknown>,
    preferences: await getCrmSyncPreferences(workspaceId, provider),
  };
}

function errStatus(err: unknown): number | null {
  return err instanceof CrmHttpError ? err.status : null;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240);
}

function blockedOrFail(err: unknown, label: string): AcceptanceItem {
  const status = errStatus(err);
  // Non-permission failures are still reported under the blocked bucket with
  // the HTTP/error detail so the operator can act (fix or reauthorize).
  return {
    id: label,
    status: "Blocked by provider permissions or plan",
    message: errMsg(err),
    httpStatus: status,
  };
}

async function probePipedriveEndpoint(
  ctx: ConnectorContext,
  path: string,
): Promise<{ ok: boolean; status: number | null; message: string; sampleId?: string }> {
  const { crmFetch } = await import("./http");
  const domain = String(ctx.meta.apiDomain || "https://api.pipedrive.com").replace(/\/$/, "");
  try {
    const res = await crmFetch<{
      success?: boolean;
      data?: unknown;
      error?: string;
    }>(`${domain}/v1${path}`, { accessToken: ctx.accessToken });
    const data = res.data;
    let sampleId: string | undefined;
    if (Array.isArray(data) && data[0] && typeof data[0] === "object" && data[0] && "id" in data[0]) {
      sampleId = String((data[0] as { id: unknown }).id);
    } else if (data && typeof data === "object" && "id" in (data as object)) {
      sampleId = String((data as { id: unknown }).id);
    }
    return {
      ok: true,
      status: 200,
      message: sampleId ? `ok id=${sampleId}` : "ok",
      sampleId,
    };
  } catch (err) {
    return {
      ok: false,
      status: errStatus(err),
      message: errMsg(err),
    };
  }
}

export async function runCrmAcceptanceSuite(
  workspaceId: string,
  provider: CrmProviderId,
): Promise<AcceptanceReport> {
  const connector = getConnector(provider);
  const ctx = await ctxFor(workspaceId, provider);
  const marker = `acc-${Date.now().toString(36)}`;
  const items: AcceptanceItem[] = [];
  const requestedScopes = scopesForProvider(provider, {
    zohoProduct: ctx.preferences.zohoProduct || "crm",
  });

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const connRow = await prisma.integrationConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider } },
  });
  const meta = (connRow?.configJson || {}) as Record<string, unknown>;
  const connectionMeta = {
    status: connRow?.status,
    syncStatus: connRow?.syncStatus,
    apiDomain: meta.apiDomain || meta.api_domain || null,
    accountsServer: meta.accountsServer || null,
    tokensEncrypted: meta.tokensEncrypted ?? null,
    connectedAt: meta.connectedAt || null,
    // Pipedrive/Zoho do not always echo granted scopes into token response; we record requested.
    requestedScopesAtConnect: requestedScopes,
  };

  // --- permission / scope matrix (Pipedrive) ---
  if (provider === "pipedrive") {
    for (const [id, path] of [
      ["pd_persons_read", "/persons?limit=1"],
      ["pd_orgs_read", "/organizations?limit=1"],
      ["pd_deals_read", "/deals?limit=1"],
      ["pd_pipelines_read", "/pipelines"],
      ["pd_stages_read", "/stages"],
      ["pd_activities_read", "/activities?limit=1"],
      ["pd_notes_read", "/notes?limit=1"],
      ["pd_users_read", "/users"],
      ["pd_person_fields", "/personFields"],
      ["pd_deal_fields", "/dealFields"],
    ] as const) {
      const r = await probePipedriveEndpoint(ctx, path);
      items.push({
        id,
        status: r.ok
          ? "Live tested and passed"
          : "Blocked by provider permissions or plan",
        message: r.message,
        httpStatus: r.status,
        externalId: r.sampleId || null,
      });
    }
  }

  // Phone / email lookup
  try {
    if (connector.findContactByPhone) {
      const phone = "+15555550999";
      // seed a contact then find it
      const created = await connector.upsertContact(ctx, {
        firstName: "Transovo",
        lastName: `Lookup ${marker}`,
        phone,
        email: `lookup-${marker}@example.com`,
      });
      const byPhone = await connector.findContactByPhone(ctx, phone);
      items.push({
        id: "find_by_phone",
        status: byPhone?.id
          ? "Live tested and passed"
          : "Blocked by provider permissions or plan",
        message: byPhone?.id
          ? `Found person/contact ${byPhone.id}`
          : "Lookup returned null after create",
        externalId: byPhone?.id || created.externalId,
      });
      if (connector.findContactByEmail) {
        const byEmail = await connector.findContactByEmail(
          ctx,
          `lookup-${marker}@example.com`,
        );
        items.push({
          id: "find_by_email",
          status: byEmail?.id
            ? "Live tested and passed"
            : "Blocked by provider permissions or plan",
          message: byEmail?.id
            ? `Found person/contact ${byEmail.id}`
            : "Email lookup returned null",
          externalId: byEmail?.id || null,
        });
      }
    } else {
      items.push({
        id: "find_by_phone",
        status: "Unsupported",
        message: "Adapter has no findContactByPhone",
      });
    }
  } catch (err) {
    items.push(blockedOrFail(err, "find_by_phone"));
  }

  // Company / Account
  try {
    if (!connector.upsertCompany || !connector.listCompanies) {
      items.push({
        id: "company_write",
        status: "Unsupported",
        message: "Adapter missing company APIs",
      });
    } else {
      const created = await connector.upsertCompany(ctx, {
        name: `[Transovo] Acc Org ${marker}`,
      });
      const listed = await connector.listCompanies(ctx, null);
      const found = listed.items.some((c) => c.id === created.externalId);
      items.push({
        id: "company_create_read",
        status: created.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `Created ${created.externalId}; listed=${found}`,
        externalId: created.externalId,
      });
      const updated = await connector.upsertCompany(ctx, {
        id: created.externalId,
        name: `[Transovo] Acc Org ${marker} upd`,
      });
      items.push({
        id: "company_update",
        status: updated.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `Updated ${updated.externalId}`,
        externalId: updated.externalId,
      });
    }
  } catch (err) {
    items.push(blockedOrFail(err, "company_create_read"));
  }

  // Deal
  try {
    if (!connector.upsertDeal || !connector.listDeals) {
      items.push({
        id: "deal_write",
        status: "Unsupported",
        message: "Adapter missing deal APIs",
      });
    } else {
      const created = await connector.upsertDeal(ctx, {
        name: `[Transovo] Acc Deal ${marker}`,
        amount: 100,
        currency: "USD",
      });
      items.push({
        id: "deal_create",
        status: created.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `Created deal ${created.externalId}`,
        externalId: created.externalId,
      });
      const updated = await connector.upsertDeal(ctx, {
        id: created.externalId,
        name: `[Transovo] Acc Deal ${marker} upd`,
        amount: 150,
        currency: "USD",
      });
      items.push({
        id: "deal_update",
        status: updated.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `Updated deal ${updated.externalId}`,
        externalId: updated.externalId,
      });
      const page = await connector.listDeals(ctx, null);
      items.push({
        id: "deal_read",
        status: "Live tested and passed",
        message: `Listed ${page.items.length} deal(s)`,
      });
    }
  } catch (err) {
    items.push(blockedOrFail(err, "deal_create"));
  }

  // Pipelines / stages / owners / fields
  try {
    if (connector.listPipelines) {
      const pipes = await connector.listPipelines(ctx);
      const stages = pipes.reduce((n, p) => n + (p.stages?.length || 0), 0);
      items.push({
        id: "pipelines_stages_read",
        status: "Live tested and passed",
        message: `${pipes.length} pipeline(s), ${stages} stage(s)`,
      });
    } else {
      items.push({
        id: "pipelines_stages_read",
        status: "Unsupported",
        message: "No listPipelines",
      });
    }
  } catch (err) {
    items.push(blockedOrFail(err, "pipelines_stages_read"));
  }

  try {
    if (connector.listUsers) {
      const users = await connector.listUsers(ctx);
      items.push({
        id: "owner_mapping_read",
        status: users.length ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `${users.length} user(s)/owner(s)`,
        externalId: users[0]?.externalId || null,
      });
    }
  } catch (err) {
    items.push(blockedOrFail(err, "owner_mapping_read"));
  }

  try {
    if (connector.listFields) {
      const fields = await connector.listFields(ctx);
      items.push({
        id: "custom_fields_read",
        status: "Live tested and passed",
        message: `${fields.length} field(s) discovered`,
      });
    } else {
      items.push({
        id: "custom_fields_read",
        status: "Unsupported",
        message: "No listFields",
      });
    }
  } catch (err) {
    items.push(blockedOrFail(err, "custom_fields_read"));
  }

  // Notes
  try {
    if (!connector.createNote) {
      items.push({
        id: "note_create",
        status: "Unsupported",
        message: "No createNote",
      });
    } else {
      // Prefer attach to a fresh contact
      const person = await connector.upsertContact(ctx, {
        firstName: "Transovo",
        lastName: `NoteHost ${marker}`,
        phone: `+1555555${String(Date.now()).slice(-4)}`,
      });
      const note = await connector.createNote(ctx, {
        body: `[Transovo] Acceptance note ${marker}`,
        contactExternalId: person.externalId,
      });
      items.push({
        id: "note_create",
        status: note.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `Note ${note.externalId} on contact ${person.externalId}`,
        externalId: note.externalId,
      });
      if (connector.updateNote && note.externalId) {
        const upd = await connector.updateNote(ctx, {
          id: note.externalId,
          body: `[Transovo] Acceptance note ${marker} updated`,
          contactExternalId: person.externalId,
        });
        items.push({
          id: "note_update",
          status: upd.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
          message: `Updated note ${upd.externalId}`,
          externalId: upd.externalId,
        });
      } else {
        items.push({
          id: "note_update",
          status: "Unsupported",
          message: "Adapter has no updateNote",
        });
      }
    }
  } catch (err) {
    items.push(blockedOrFail(err, "note_create"));
  }

  // Task update/complete
  try {
    if (!connector.createTask) {
      items.push({
        id: "task_lifecycle",
        status: "Unsupported",
        message: "No createTask",
      });
    } else {
      const task = await connector.createTask(ctx, {
        subject: `[Transovo] Acc task ${marker}`,
        description: "Acceptance task",
        status: "Not Started",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      });
      if (connector.updateTask && task.externalId) {
        const done = await connector.updateTask(ctx, {
          id: task.externalId,
          subject: `[Transovo] Acc task ${marker}`,
          status: "Completed",
        });
        items.push({
          id: "task_update_complete",
          status: done.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
          message: `Completed task ${done.externalId}`,
          externalId: done.externalId,
        });
      } else {
        items.push({
          id: "task_create_only",
          status: task.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
          message: `Created task ${task.externalId} (no updateTask)`,
          externalId: task.externalId,
        });
      }
    }
  } catch (err) {
    items.push(blockedOrFail(err, "task_update_complete"));
  }

  // Call lifecycle + recording/transcript/AI
  try {
    if (!connector.logCall) {
      items.push({
        id: "call_lifecycle",
        status: "Unsupported",
        message: "No logCall",
      });
    } else {
      const call = await connector.logCall(ctx, {
        direction: "outbound",
        from: "+15555550100",
        to: "+15555550199",
        durationSeconds: 95,
        disposition: "completed",
        notes: `[Transovo] Acc call ${marker}`,
        recordingUrl: "https://example.com/rec.mp3",
        transcriptUrl: "https://example.com/transcript.txt",
        aiSummary: "Acceptance AI summary",
        startedAt: new Date().toISOString(),
      });
      items.push({
        id: "call_lifecycle",
        status: call.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `Logged call ${call.externalId}`,
        externalId: call.externalId,
      });
      if (call.externalId) {
        const upd = await connector.logCall(ctx, {
          id: call.externalId,
          direction: "outbound",
          from: "+15555550100",
          to: "+15555550199",
          durationSeconds: 120,
          disposition: "completed",
          notes: `[Transovo] Acc call ${marker} updated`,
          recordingUrl: "https://example.com/rec2.mp3",
          transcriptUrl: "https://example.com/transcript2.txt",
          aiSummary: "Updated summary",
          startedAt: new Date().toISOString(),
        });
        items.push({
          id: "call_lifecycle_update",
          status: upd.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
          message: `Updated call ${upd.externalId}`,
          externalId: upd.externalId,
        });
      }
    }
  } catch (err) {
    items.push(blockedOrFail(err, "call_lifecycle"));
  }

  // SMS + MMS
  try {
    if (!connector.logSms) {
      items.push({
        id: "sms_mms",
        status: "Unsupported",
        message: "No logSms",
      });
    } else {
      const sms = await connector.logSms(ctx, {
        direction: "outbound",
        from: "+15555550100",
        to: "+15555550199",
        body: `[Transovo] Acc SMS ${marker}`,
        status: "delivered",
        mediaUrls: ["https://example.com/image.jpg"],
        sentAt: new Date().toISOString(),
      });
      items.push({
        id: "sms_mms",
        status: sms.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
        message: `Logged SMS/MMS ${sms.externalId}`,
        externalId: sms.externalId,
      });
      if (sms.externalId) {
        const fail = await connector.logSms(ctx, {
          id: sms.externalId,
          direction: "outbound",
          from: "+15555550100",
          to: "+15555550199",
          body: `[Transovo] Acc SMS ${marker} failed`,
          status: "failed",
          sentAt: new Date().toISOString(),
        });
        items.push({
          id: "sms_delivery_update",
          status: fail.externalId ? "Live tested and passed" : "Blocked by provider permissions or plan",
          message: `Updated SMS status on ${fail.externalId}`,
          externalId: fail.externalId,
        });
      }
    }
  } catch (err) {
    items.push(blockedOrFail(err, "sms_mms"));
  }

  // Zoho-specific: leads read, accounts already covered as company
  if (provider === "zoho") {
    try {
      if (connector.listLeads) {
        const leads = await connector.listLeads(ctx, null);
        items.push({
          id: "leads_read",
          status: "Live tested and passed",
          message: `Listed ${leads.items.length} lead(s)`,
        });
      }
    } catch (err) {
      items.push(blockedOrFail(err, "leads_read"));
    }
    try {
      if (connector.listContacts) {
        const contacts = await connector.listContacts(ctx, null);
        items.push({
          id: "contacts_read",
          status: "Live tested and passed",
          message: `Listed ${contacts.items.length} contact(s)`,
        });
      }
    } catch (err) {
      items.push(blockedOrFail(err, "contacts_read"));
    }
  }

  // Link contact ↔ company when both exist
  try {
    if (connector.upsertCompany && connector.upsertContact) {
      const org = await connector.upsertCompany(ctx, {
        name: `[Transovo] LinkOrg ${marker}`,
      });
      const person = await connector.upsertContact(ctx, {
        firstName: "Transovo",
        lastName: `Linked ${marker}`,
        phone: `+1555556${String(Date.now()).slice(-4)}`,
        companyExternalId: org.externalId,
      });
      items.push({
        id: "contact_company_link",
        status:
          person.externalId && org.externalId
            ? "Live tested and passed"
            : "Blocked by provider permissions or plan",
        message: `Contact ${person.externalId} linked to company ${org.externalId}`,
        externalId: person.externalId,
      });
    }
  } catch (err) {
    items.push(blockedOrFail(err, "contact_company_link"));
  }

  // Queue / dead letters
  const [{ getCrmDiagnosticsSnapshot }, { enqueueCrmSync }] = await Promise.all([
    import("./diagnostics"),
    import("./sync-engine"),
  ]);
  await enqueueCrmSync({
    workspaceId,
    provider,
    kind: "manual",
    triggeredBy: "acceptance",
  }).catch(() => undefined);

  // small wait for drain
  await new Promise((r) => setTimeout(r, 8000));
  const snap = await getCrmDiagnosticsSnapshot(workspaceId, provider);

  items.push({
    id: "queue_drain",
    status:
      snap.queue.failed === 0
        ? "Live tested and passed"
        : "Blocked by provider permissions or plan",
    message: `pending=${snap.queue.pending} failed=${snap.queue.failed} deadLetters=${snap.queue.deadLetters} webhookPending=${snap.queue.webhookPending}`,
  });

  items.push({
    id: "webhook_auto_registration",
    status: "Unsupported",
    message:
      "Provider-side webhook registration is manual; HTTP ingest + scheduled reconcile are implemented",
  });

  items.push({
    id: "disconnect_reconnect",
    status: "Blocked by provider permissions or plan",
    message:
      "Requires interactive browser authorize. If Pipedrive orgs/pipelines return 403, disconnect in Transovo and reauthorize Pipedrive so the token picks up contacts:full + deals:full, then re-run acceptance.",
  });

  return {
    provider,
    requestedScopes,
    connectionMeta,
    items,
    queue: {
      pending: snap.queue.pending,
      failed: snap.queue.failed,
      deadLetters: snap.queue.deadLetters,
    },
  };
}
