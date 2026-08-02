/**
 * Diagnose + repair Telnyx inbound PSTN routing for a workspace DID.
 * Ensures the number is attached to TELNYX_CONNECTION_ID and that the Call
 * Control Application webhook points at /api/telnyx/voice.
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
  expectedConnectionId: string | null;
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

async function fetchCallControlApp(connectionId: string) {
  try {
    const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
      `/call_control_applications/${encodeURIComponent(connectionId)}`,
    );
    return asRecord(res.data);
  } catch (err) {
    // Some accounts expose the same id under /connections (SIP / credential / IP)
    try {
      const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
        `/connections/${encodeURIComponent(connectionId)}`,
      );
      const conn = asRecord(res.data);
      if (conn) {
        // Surface connection_type so we can detect credential SIP trunks that
        // require a registered softphone (common cause of "as dialed" rejects).
        return {
          ...conn,
          application_name:
            conn.application_name || conn.connection_name || conn.name || "connection",
          webhook_event_url: conn.webhook_event_url || conn.webhook_url || "",
          _source: "connections",
        };
      }
      return null;
    } catch {
      throw err;
    }
  }
}

async function attachConnection(providerNumberId: string, connectionId: string) {
  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: connectionId },
  });
}

async function ensureCallControlWebhook(connectionId: string, webhookUrl: string) {
  const app = await fetchCallControlApp(connectionId);
  if (!app) throw new Error(`Call Control application ${connectionId} not found`);

  const currentUrl = String(app.webhook_event_url || "").replace(/\/$/, "");
  const want = webhookUrl.replace(/\/$/, "");
  const active = app.active !== false;
  const apiVersion = String(app.webhook_api_version || "2");
  const applicationName =
    String(app.application_name || "").trim() || "Transovo Voice";

  const needsUpdate =
    currentUrl !== want || !active || (apiVersion !== "1" && apiVersion !== "2");

  // Prefer v2 webhooks (our handler expects the v2 envelope).
  if (currentUrl === want && active && apiVersion === "2") {
    return { app, updated: false as const };
  }

  const updated = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/call_control_applications/${encodeURIComponent(connectionId)}`,
    {
      method: "PATCH",
      body: {
        application_name: applicationName,
        webhook_event_url: want,
        webhook_api_version: "2",
        active: true,
        ...(app.webhook_event_failover_url
          ? { webhook_event_failover_url: app.webhook_event_failover_url }
          : {}),
        ...(app.webhook_timeout_secs != null
          ? { webhook_timeout_secs: app.webhook_timeout_secs }
          : {}),
      },
    },
  );

  return { app: asRecord(updated.data) || app, updated: needsUpdate || true };
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
  const expectedConnectionId = process.env.TELNYX_CONNECTION_ID?.trim() || null;
  const issues: InboundDiagIssue[] = [];
  const repairs: string[] = [];

  if (!getTelnyxApiKey()) {
    issues.push({
      code: "missing_api_key",
      severity: "error",
      message: "TELNYX_API_KEY is not configured on the server",
    });
  }
  if (!expectedConnectionId) {
    issues.push({
      code: "missing_connection_id",
      severity: "error",
      message: "TELNYX_CONNECTION_ID is not configured on the server",
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
      // Fall back to Telnyx list lookup by E.164
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
      const connectionId = phoneNumber.connection_id
        ? String(phoneNumber.connection_id)
        : "";

      if (caps && caps.voice === false) {
        issues.push({
          code: "voice_capability_disabled",
          severity: "error",
          message: "Telnyx reports voice capability disabled on this number",
        });
      }

      if (!connectionId) {
        issues.push({
          code: "no_connection",
          severity: "error",
          message:
            "Number has no Call Control connection — inbound PSTN cannot route to Transovo",
        });
      } else if (
        expectedConnectionId &&
        connectionId !== expectedConnectionId
      ) {
        issues.push({
          code: "wrong_connection",
          severity: "error",
          message: `Number is on connection ${connectionId}, expected ${expectedConnectionId}`,
        });
      }

      if (
        input.repair &&
        expectedConnectionId &&
        connectionId !== expectedConnectionId
      ) {
        await attachConnection(providerNumberId, expectedConnectionId);
        repairs.push(`Attached number to connection ${expectedConnectionId}`);
        phoneNumber = await fetchPhoneNumber(providerNumberId);
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

        const voiceConn = voiceSettings.connection_id
          ? String(voiceSettings.connection_id)
          : "";
        if (
          expectedConnectionId &&
          voiceConn &&
          voiceConn !== expectedConnectionId
        ) {
          issues.push({
            code: "voice_wrong_connection",
            severity: "error",
            message: `Voice settings connection_id is ${voiceConn}, expected ${expectedConnectionId}`,
          });
        }
      }
    }

    if (expectedConnectionId) {
      try {
        if (input.repair) {
          const { app, updated } = await ensureCallControlWebhook(
            expectedConnectionId,
            expectedWebhookUrl,
          );
          callControlApp = app;
          if (updated) {
            repairs.push(`Set Call Control webhook to ${expectedWebhookUrl}`);
          }
        } else {
          callControlApp = await fetchCallControlApp(expectedConnectionId);
        }

        if (callControlApp) {
          const source = String(callControlApp._source || "call_control_applications");
          const connType = String(
            callControlApp.connection_type ||
              callControlApp.record_type ||
              source,
          );
          if (
            /credential|ip_connection|fqdn|sip_connection/i.test(connType) ||
            source === "connections"
          ) {
            issues.push({
              code: "connection_not_call_control",
              severity: "error",
              message:
                `TELNYX_CONNECTION_ID looks like a SIP/credential connection (${connType}), not a Call Control Application. ` +
                `Inbound PSTN fails with "cannot be completed as dialed" unless a softphone is registered — ` +
                `point the DID at a Call Control app with webhook ${expectedWebhookUrl}`,
            });
          }
          if (callControlApp.active === false) {
            issues.push({
              code: "connection_inactive",
              severity: "error",
              message: "Call Control application is inactive",
            });
          }
          const wh = String(callControlApp.webhook_event_url || "").replace(
            /\/$/,
            "",
          );
          if (wh !== expectedWebhookUrl.replace(/\/$/, "")) {
            issues.push({
              code: "webhook_mismatch",
              severity: "error",
              message: `Call Control webhook is "${wh || "(empty)"}", expected "${expectedWebhookUrl}"`,
            });
          }
          const ver = String(callControlApp.webhook_api_version || "");
          if (ver && ver !== "2") {
            issues.push({
              code: "webhook_api_version",
              severity: "warn",
              message: `webhook_api_version is ${ver}; Transovo expects v2`,
            });
          }
        }
      } catch (err) {
        issues.push({
          code: "connection_fetch_failed",
          severity: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // After applying repairs, re-read so `issues` / `ready` reflect live Telnyx state.
  if (input.repair && repairs.length > 0) {
    const again = await diagnoseAndRepairInboundNumber({
      workspaceId: input.workspaceId,
      e164,
      repair: false,
    });
    return { ...again, repairs };
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
    Boolean(expectedConnectionId) &&
    finalConn === expectedConnectionId &&
    finalWh === expectedWebhookUrl.replace(/\/$/, "") &&
    callControlApp?.active !== false &&
    blockingErrors.length === 0;

  return {
    e164,
    appBaseUrl: getAppBaseUrl(),
    expectedWebhookUrl,
    expectedConnectionId,
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
          first_command_timeout: callControlApp.first_command_timeout,
          first_command_timeout_secs: callControlApp.first_command_timeout_secs,
        }
      : null,
    workspaceNumber,
    issues,
    repairs,
    ready,
  };
}
