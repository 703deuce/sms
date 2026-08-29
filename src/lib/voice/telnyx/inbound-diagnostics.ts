/**
 * Diagnose + repair Telnyx inbound PSTN routing for a workspace DID.
 * Ensures the number is attached to a Call Control Application (not a
 * softphone credential connection) with webhook → /api/telnyx/voice.
 */

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import {
  getAppBaseUrl,
  getTelnyxApiKey,
  getTelnyxWebhookUrls,
} from "@/lib/messaging/telnyx/config";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type InboundDiagIssue = {
  code: string;
  severity: "error" | "warn" | "info";
  message: string;
};

export type InboundDiagResult = {
  e164: string;
  appBaseUrl: string;
  expectedWebhookUrl: string;
  /** Coolify TELNYX_CONNECTION_ID (may be a softphone credential connection). */
  expectedConnectionId: string | null;
  /** Call Control Application id the DID should use (created/found during repair). */
  recommendedConnectionId: string | null;
  phoneNumber: Record<string, unknown> | null;
  voiceSettings: Record<string, unknown> | null;
  callControlApp: Record<string, unknown> | null;
  workspaceNumber: {
    id: string;
    status: string;
    providerNumberId: string | null;
    agentId: string | null;
    agentStatus: string | null;
    assistantId: string | null;
  } | null;
  issues: InboundDiagIssue[];
  repairs: string[];
  ready: boolean;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function routingModeForPhone(settingsJson: unknown): string {
  const settings =
    settingsJson && typeof settingsJson === "object"
      ? (settingsJson as {
          telephony?: { routingMode?: string };
          provisioning?: { routingMode?: string };
        })
      : {};
  const telephony = settings.telephony || settings.provisioning;
  return String(telephony?.routingMode || "").toLowerCase();
}
  if (!app) return false;
  const source = String(app._source || "");
  const connType = String(
    app.connection_type || app.record_type || source || "",
  );
  if (source === "connections") return true;
  return /credential|ip_connection|fqdn|sip_connection/i.test(connType);
}

function isCallControlApp(app: Record<string, unknown> | null): boolean {
  if (!app) return false;
  if (isCredentialLike(app)) return false;
  const rt = String(app.record_type || "");
  return rt === "call_control_application" || Boolean(app.application_name && app.id);
}

async function fetchPhoneNumber(providerNumberId: string) {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  return asRecord(res.data);
}

async function fetchVoiceSettings(providerNumberId: string) {
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/phone_numbers/${encodeURIComponent(providerNumberId)}/voice`,
    );
    return asRecord(res.data);
  } catch {
    return null;
  }
}

async function fetchConnectionOrApp(connectionId: string) {
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/call_control_applications/${encodeURIComponent(connectionId)}`,
    );
    const app = asRecord(res.data);
    if (app) return { ...app, _source: "call_control_applications" };
  } catch {
    // fall through
  }
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/connections/${encodeURIComponent(connectionId)}`,
    );
    const conn = asRecord(res.data);
    if (conn) {
      return {
        ...conn,
        application_name:
          conn.application_name || conn.connection_name || conn.name || "connection",
        webhook_event_url: conn.webhook_event_url || conn.webhook_url || "",
        _source: "connections",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function listCallControlApplications(): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let page = 1;
  for (;;) {
    const res = await telnyxRequest<{
      data?: Array<Record<string, unknown>>;
      meta?: { total_pages?: number };
    }>("/call_control_applications", {
      query: { "page[number]": page, "page[size]": 50 },
    });
    const rows = res.data || [];
    for (const row of rows) out.push({ ...row, _source: "call_control_applications" });
    const totalPages = Number(res.meta?.total_pages || 1);
    if (page >= totalPages || rows.length === 0) break;
    page += 1;
    if (page > 10) break;
  }
  return out;
}

async function attachConnection(providerNumberId: string, connectionId: string) {
  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });
}

/**
 * Find or create a Call Control Application with the Transovo voice webhook.
 */
async function ensureVoiceCallControlApplication(webhookUrl: string): Promise<{
  app: Record<string, unknown>;
  created: boolean;
  updated: boolean;
}> {
  const want = webhookUrl.replace(/\/$/, "");
  const apps = await listCallControlApplications();

  const byWebhook = apps.find(
    (a) => String(a.webhook_event_url || "").replace(/\/$/, "") === want,
  );
  const byName = apps.find((a) =>
    /transovo/i.test(String(a.application_name || "")),
  );
  let app = byWebhook || byName || null;
  let created = false;
  let updated = false;

  if (!app) {
    const createdRes = await telnyxRequest<{ data?: Record<string, unknown> }>(
      "/call_control_applications",
      {
        method: "POST",
        body: {
          application_name: "Transovo Voice",
          webhook_event_url: want,
          webhook_api_version: "2",
          active: true,
          first_command_timeout: true,
          first_command_timeout_secs: 30,
        },
      },
    );
    app = asRecord(createdRes.data);
    if (!app?.id) throw new Error("Failed to create Call Control Application");
    app = { ...app, _source: "call_control_applications" };
    created = true;
    return { app, created, updated: false };
  }

  const id = String(app.id);
  const currentUrl = String(app.webhook_event_url || "").replace(/\/$/, "");
  const active = app.active !== false;
  const apiVersion = String(app.webhook_api_version || "");
  if (currentUrl !== want || !active || apiVersion !== "2") {
    const patched = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/call_control_applications/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: {
          application_name:
            String(app.application_name || "").trim() || "Transovo Voice",
          webhook_event_url: want,
          webhook_api_version: "2",
          active: true,
        },
      },
    );
    app = { ...(asRecord(patched.data) || app), _source: "call_control_applications" };
    updated = true;
  }

  return { app, created, updated };
}

/**
 * Inspect Telnyx + Transovo state for a DID. Optionally repair connection/webhook.
 */
export async function diagnoseAndRepairInboundNumber(input: {
  workspaceId: string;
  e164: string;
  repair?: boolean;
}): Promise<InboundDiagResult> {
  const e164 = normalizeE164(input.e164);
  const expectedWebhookUrl = getTelnyxWebhookUrls().voice;
  const envConnectionId = process.env.TELNYX_CONNECTION_ID?.trim() || null;
  const issues: InboundDiagIssue[] = [];
  const repairs: string[] = [];
  let recommendedConnectionId: string | null = null;

  if (!getTelnyxApiKey()) {
    issues.push({
      code: "missing_api_key",
      severity: "error",
      message: "TELNYX_API_KEY is not configured on the server",
    });
  }
  if (!envConnectionId) {
    issues.push({
      code: "missing_connection_id",
      severity: "warn",
      message:
        "TELNYX_CONNECTION_ID is not set — inbound can still work if the DID is on a Call Control app",
    });
  }

  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164 },
  });

  const agent = row
    ? await prisma.voiceAgent.findFirst({
        where: { workspaceId: input.workspaceId, phoneNumberId: row.id },
        select: {
          id: true,
          status: true,
          telnyxAssistantId: true,
        },
      })
    : null;

  const workspaceNumber = row
    ? {
        id: row.id,
        status: String(row.status || ""),
        providerNumberId: row.providerNumberId ? String(row.providerNumberId) : null,
        agentId: agent?.id || null,
        agentStatus: agent?.status || null,
        assistantId: agent?.telnyxAssistantId || null,
      }
    : null;

  if (!row) {
    issues.push({
      code: "not_in_workspace",
      severity: "error",
      message: `Number ${e164} is not imported into this workspace`,
    });
  } else if (String(row.status) !== "Active") {
    issues.push({
      code: "number_inactive",
      severity: "error",
      message: `Workspace number status is ${row.status}, expected Active`,
    });
  }

  if (row && !agent) {
    issues.push({
      code: "no_agent_assigned",
      severity: "warn",
      message:
        "No voice agent is assigned to this number — inbound may fall through to human/IVR routing",
    });
  } else if (agent && String(agent.status) !== "ACTIVE") {
    issues.push({
      code: "agent_not_active",
      severity: "warn",
      message: `Assigned agent status is ${agent.status}, expected ACTIVE`,
    });
  } else if (agent && !agent.telnyxAssistantId) {
    issues.push({
      code: "missing_assistant_id",
      severity: "warn",
      message: "Assigned agent has no Telnyx assistant id — rebuild/sync the agent",
    });
  }

  let phoneNumber: Record<string, unknown> | null = null;
  let voiceSettings: Record<string, unknown> | null = null;
  let callControlApp: Record<string, unknown> | null = null;

  const providerNumberId =
    workspaceNumber?.providerNumberId ||
    (await (async () => {
      try {
        const listed = await telnyxRequest<{
          data?: Array<Record<string, unknown>>;
        }>("/phone_numbers", {
          query: { "filter[phone_number]": e164, "page[size]": 1 },
        });
        const id = listed.data?.[0]?.id;
        return id ? String(id) : null;
      } catch {
        return null;
      }
    })());

  if (!providerNumberId) {
    issues.push({
      code: "missing_provider_id",
      severity: "error",
      message: "Could not resolve Telnyx phone number id for this E.164",
    });
  } else if (getTelnyxApiKey()) {
    phoneNumber = await fetchPhoneNumber(providerNumberId).catch((err) => {
      issues.push({
        code: "phone_fetch_failed",
        severity: "error",
        message: err instanceof Error ? err.message : String(err),
      });
      return null;
    });

    // Resolve env connection type up front.
    let envApp: Record<string, unknown> | null = null;
    if (envConnectionId) {
      envApp = await fetchConnectionOrApp(envConnectionId);
    }

    // Ensure we have a real Call Control Application for inbound voice.
    try {
      if (input.repair) {
        const ensured = await ensureVoiceCallControlApplication(expectedWebhookUrl);
        callControlApp = ensured.app;
        recommendedConnectionId = String(ensured.app.id);
        if (ensured.created) {
          repairs.push(
            `Created Call Control Application ${recommendedConnectionId} (Transovo Voice)`,
          );
        } else if (ensured.updated) {
          repairs.push(`Updated Call Control webhook to ${expectedWebhookUrl}`);
        }
        try {
          const { ensureTelnyxOutboundVoiceReady } = await import(
            "@/lib/phone/telnyx-outbound-voice"
          );
          const outbound = await ensureTelnyxOutboundVoiceReady({
            connectionId: recommendedConnectionId,
            callerIdE164: e164,
          });
          if (outbound.createdProfile) {
            repairs.push(
              `Created Outbound Voice Profile ${outbound.outboundVoiceProfileId}`,
            );
          }
          if (outbound.attachedConnection) {
            repairs.push(
              `Attached Voice API Application to Outbound Voice Profile ${outbound.outboundVoiceProfileId}`,
            );
          }
          if (!outbound.ready) {
            for (const issue of outbound.issues) {
              issues.push({
                code: `outbound_${issue.code}`,
                severity: issue.severity,
                message: issue.message,
              });
            }
          }
        } catch (err) {
          issues.push({
            code: "outbound_ensure_failed",
            severity: "warn",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (envApp && isCallControlApp(envApp)) {
        callControlApp = envApp;
        recommendedConnectionId = String(envApp.id);
      } else {
        // Diagnose-only: look for an existing Transovo / matching-webhook CC app.
        const apps = await listCallControlApplications().catch(() => []);
        const want = expectedWebhookUrl.replace(/\/$/, "");
        const found =
          apps.find(
            (a) => String(a.webhook_event_url || "").replace(/\/$/, "") === want,
          ) ||
          apps.find((a) => /transovo/i.test(String(a.application_name || ""))) ||
          null;
        if (found) {
          callControlApp = found;
          recommendedConnectionId = String(found.id);
        } else if (envApp) {
          callControlApp = envApp;
        }
      }
    } catch (err) {
      issues.push({
        code: "connection_fetch_failed",
        severity: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }

    if (phoneNumber) {
      const status = String(phoneNumber.status || "");
      if (status && status !== "active") {
        issues.push({
          code: "telnyx_number_not_active",
          severity: "error",
          message: `Telnyx number status is "${status}" — PSTN may play "cannot be completed as dialed" until active`,
        });
      }

      const caps = asRecord(phoneNumber.capabilities);
      const numberConnId = phoneNumber.connection_id
        ? String(phoneNumber.connection_id)
        : "";

      if (caps && caps.voice === false) {
        issues.push({
          code: "voice_capability_disabled",
          severity: "error",
          message: "Telnyx reports voice capability disabled on this number",
        });
      }

      const targetCcId = recommendedConnectionId;

      if (!numberConnId) {
        issues.push({
          code: "no_connection",
          severity: "error",
          message:
            "Number has no Call Control connection — inbound PSTN cannot route to Transovo",
        });
      } else if (targetCcId && numberConnId !== targetCcId) {
        // Number may be on the softphone credential connection.
        const numberConn = await fetchConnectionOrApp(numberConnId);
        if (isCredentialLike(numberConn) || numberConnId === envConnectionId) {
          issues.push({
            code: "number_on_credential_connection",
            severity: input.repair ? "warn" : "error",
            message: `Number is attached to connection ${numberConnId} (credential/softphone). It must use Call Control ${targetCcId}.`,
          });
        } else {
          issues.push({
            code: "wrong_connection",
            severity: input.repair ? "warn" : "error",
            message: `Number is on connection ${numberConnId}, expected Call Control ${targetCcId}`,
          });
        }
      }

      if (input.repair && targetCcId && numberConnId !== targetCcId) {
        const { workspaceNumberUsesTexmlDirect } = await import(
          "@/lib/voice/telnyx/texml-direct-route"
        );
        const texmlDirect = row
          ? await workspaceNumberUsesTexmlDirect({
              workspaceId: input.workspaceId,
              phoneNumberId: row.id,
            })
          : false;
        const livekitSip = row ? routingModeForPhone(row.settingsJson) === "livekit_sip" : false;
        if (texmlDirect) {
          repairs.push(
            `Skipped Call Control attach — agent uses TeXML direct (left on ${numberConnId || "current connection"})`,
          );
        } else if (livekitSip) {
          repairs.push(
            `Skipped Call Control attach — number uses LiveKit SIP inbound (left on ${numberConnId || "current connection"})`,
          );
        } else {
          await attachConnection(providerNumberId, targetCcId);
          repairs.push(`Attached number to Call Control Application ${targetCcId}`);
          phoneNumber = await fetchPhoneNumber(providerNumberId);
        }
      }

      voiceSettings = await fetchVoiceSettings(providerNumberId);
      if (voiceSettings) {
        const screening = String(voiceSettings.inbound_call_screening || "disabled");
        if (screening === "reject_calls") {
          issues.push({
            code: "inbound_screening_reject",
            severity: "error",
            message:
              "inbound_call_screening is reject_calls — inbound calls are rejected before your app",
          });
          if (input.repair) {
            await telnyxRequest(
              `/phone_numbers/${encodeURIComponent(providerNumberId)}/voice`,
              {
                method: "PATCH",
                body: { inbound_call_screening: "disabled" },
              },
            );
            repairs.push("Disabled inbound_call_screening reject_calls");
            voiceSettings = await fetchVoiceSettings(providerNumberId);
          }
        }
      }
    }

    if (callControlApp && isCallControlApp(callControlApp)) {
      if (callControlApp.active === false) {
        issues.push({
          code: "connection_inactive",
          severity: "error",
          message: "Call Control application is inactive",
        });
      }
      const wh = String(callControlApp.webhook_event_url || "").replace(/\/$/, "");
      if (wh !== expectedWebhookUrl.replace(/\/$/, "")) {
        issues.push({
          code: "webhook_mismatch",
          severity: "error",
          message: `Call Control webhook is "${wh || "(empty)"}", expected "${expectedWebhookUrl}"`,
        });
      }
      if (envApp && isCredentialLike(envApp)) {
        issues.push({
          code: "connection_not_call_control",
          severity: "warn",
          message:
            `Coolify TELNYX_CONNECTION_ID (${envConnectionId}) is still the softphone credential connection. ` +
            `Inbound uses the DID's Call Control app; update Coolify to ${recommendedConnectionId || "the Transovo Voice app id"} for outbound dials.`,
        });
      }
      if (
        envConnectionId &&
        recommendedConnectionId &&
        envConnectionId !== recommendedConnectionId
      ) {
        issues.push({
          code: "update_coolify_connection_id",
          severity: "warn",
          message: `Set Coolify env TELNYX_CONNECTION_ID=${recommendedConnectionId} (replace softphone credential id) then redeploy. Inbound may already work; outbound dials need the new id.`,
        });
      }
    } else if (!callControlApp) {
      issues.push({
        code: "no_call_control_app",
        severity: "error",
        message: `No Call Control Application found for webhook ${expectedWebhookUrl}`,
      });
    }
  }

  // After applying repairs, re-read so `issues` / `ready` reflect live Telnyx state.
  if (input.repair && repairs.length > 0) {
    const again = await diagnoseAndRepairInboundNumber({
      workspaceId: input.workspaceId,
      e164,
      repair: false,
    });
    return {
      ...again,
      repairs,
      recommendedConnectionId:
        again.recommendedConnectionId || recommendedConnectionId,
    };
  }

  const finalConn = phoneNumber?.connection_id
    ? String(phoneNumber.connection_id)
    : "";
  const finalWh = callControlApp?.webhook_event_url
    ? String(callControlApp.webhook_event_url).replace(/\/$/, "")
    : "";
  const blockingErrors = issues.filter((i) => i.severity === "error");
  const ready =
    Boolean(e164) &&
    isCallControlApp(callControlApp) &&
    Boolean(recommendedConnectionId) &&
    finalConn === recommendedConnectionId &&
    finalWh === expectedWebhookUrl.replace(/\/$/, "") &&
    callControlApp?.active !== false &&
    blockingErrors.length === 0;

  return {
    e164,
    appBaseUrl: getAppBaseUrl(),
    expectedWebhookUrl,
    expectedConnectionId: envConnectionId,
    recommendedConnectionId,
    phoneNumber: phoneNumber
      ? {
          id: phoneNumber.id,
          phone_number: phoneNumber.phone_number,
          status: phoneNumber.status,
          connection_id: phoneNumber.connection_id,
          connection_name: phoneNumber.connection_name,
          messaging_profile_id: phoneNumber.messaging_profile_id,
          phone_number_type: phoneNumber.phone_number_type,
          capabilities: phoneNumber.capabilities,
        }
      : null,
    voiceSettings: voiceSettings
      ? {
          connection_id: voiceSettings.connection_id,
          inbound_call_screening: voiceSettings.inbound_call_screening,
          call_forwarding: voiceSettings.call_forwarding,
          usage_payment_method: voiceSettings.usage_payment_method,
        }
      : null,
    callControlApp: callControlApp
      ? {
          id: callControlApp.id,
          application_name: callControlApp.application_name,
          active: callControlApp.active,
          webhook_event_url: callControlApp.webhook_event_url,
          webhook_api_version: callControlApp.webhook_api_version,
          webhook_event_failover_url: callControlApp.webhook_event_failover_url,
          record_type: callControlApp.record_type,
          connection_type: callControlApp.connection_type,
          _source: callControlApp._source,
        }
      : null,
    workspaceNumber,
    issues,
    repairs,
    ready,
  };
}
