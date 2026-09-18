import { telnyxRequest } from "@/lib/messaging/telnyx/client";

export const VOICE_V3_BASIC_CC_APP_NAME = "Transovo Voice V3 Basic OpenAI SIP";

export function resolveOpenAiLiveSipTransferUri(projectId: string): string {
  const host = process.env.OPENAI_SIP_HOST?.trim() || "sip.api.openai.com";
  return `sip:${projectId}@${host};transport=tls`;
}

export function requireOpenAiProjectId(): string {
  const projectId = process.env.OPENAI_PROJECT_ID?.trim();
  if (!projectId?.startsWith("proj_")) {
    throw new Error("OPENAI_PROJECT_ID (proj_…) is required for Voice V3 Basic SIP forward");
  }
  return projectId;
}

export async function forwardInboundCallToOpenAiLiveSip(callControlId: string): Promise<void> {
  // Answer immediately so PSTN does not ring out while we validate env / transfer.
  await telnyxRequest(`/calls/${encodeURIComponent(callControlId)}/actions/answer`, {
    method: "POST",
    body: {},
  });

  const projectId = requireOpenAiProjectId();
  const to = resolveOpenAiLiveSipTransferUri(projectId);

  await telnyxRequest(`/calls/${encodeURIComponent(callControlId)}/actions/transfer`, {
    method: "POST",
    body: {
      to,
      sip_transport_protocol: "TLS",
      media_encryption: "SRTP",
      timeout_secs: 45,
    },
  });

  console.log("VOICE_V3_BASIC_TELNYX_TRANSFERRED", {
    callControlId,
    toHost: "sip.api.openai.com",
    projectConfigured: true,
  });
}

export async function findOrCreateVoiceV3BasicCallControlApp(webhookUrl: string): Promise<string> {
  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/call_control_applications",
    { query: { "page[size]": 100 } },
  );
  const existing = (listed.data || []).find(
    (row) => String(row.application_name || "") === VOICE_V3_BASIC_CC_APP_NAME,
  );
  if (existing?.id) {
    const id = String(existing.id);
    await telnyxRequest(`/call_control_applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: {
        active: true,
        webhook_event_url: webhookUrl,
        webhook_api_version: "2",
      },
    });
    return id;
  }

  const created = await telnyxRequest<{ data?: Record<string, unknown> }>("/call_control_applications", {
    method: "POST",
    body: {
      application_name: VOICE_V3_BASIC_CC_APP_NAME,
      active: true,
      webhook_event_url: webhookUrl,
      webhook_api_version: "2",
    },
  });
  const id = String(created.data?.id || "");
  if (!id) throw new Error("Failed to create Voice V3 Basic Call Control application");
  return id;
}
