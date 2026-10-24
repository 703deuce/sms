/**
 * Machine-readable Voice V3 direct-SIP provisioning recipe (GPT-Live-1 + GPT-6 Astra).
 * Source of truth for onboarding jobs — see docs/voice-v3/NEW_NUMBER_PROVISIONING.md.
 */

export type VoiceNumberProvisioningConfig = {
  provider: "telnyx";
  transport: "sip";
  /** Telnyx inbound model — Call Control application (not FQDN connection). */
  telnyxConnectionType: "call_control_application";
  openaiProjectId: string;
  openaiSipHost: string;
  openaiSipPort: 5061;
  openaiSipTransport: "tls";
  /** SIP URI presented to Telnyx transfer — `sip:{projectId}@{host};transport=tls` */
  openaiSipUriFormat: "sip:{openaiProjectId}@{openaiSipHost};transport=tls";
  telnyxTransfer: {
    sipTransportProtocol: "TLS";
    mediaEncryption: "SRTP";
    timeoutSecs: 45;
  };
  openaiWebhookEvent: "live.transport.incoming";
  /** Also accepted at runtime if OpenAI emits legacy names (see webhook handler). */
  openaiWebhookEventAliases: readonly ["live.call.incoming", "realtime.call.incoming"];
  openaiWebhookPath: "/api/openai/live/incoming";
  telnyxWebhookPath: "/api/telnyx/voice/v3-basic";
  liveModel: "gpt-live-1";
  backendModel: "gpt-6-astra";
  liveVoice: "marin";
  webhookSignatureEnv: "OPENAI_WEBHOOK_SECRET";
  requiredEnv: readonly string[];
};

export const VOICE_V3_OPENAI_SIP_HOST = "sip.api.openai.com";
export const VOICE_V3_OPENAI_SIP_PORT = 5061 as const;

export function buildOpenAiSipUri(openaiProjectId: string, host = VOICE_V3_OPENAI_SIP_HOST): string {
  return `sip:${openaiProjectId}@${host};transport=tls`;
}

export function buildVoiceNumberProvisioningConfig(input: {
  openaiProjectId: string;
  appBaseUrl: string;
}): VoiceNumberProvisioningConfig {
  const base = input.appBaseUrl.replace(/\/$/, "");
  return {
    provider: "telnyx",
    transport: "sip",
    telnyxConnectionType: "call_control_application",
    openaiProjectId: input.openaiProjectId,
    openaiSipHost: VOICE_V3_OPENAI_SIP_HOST,
    openaiSipPort: VOICE_V3_OPENAI_SIP_PORT,
    openaiSipTransport: "tls",
    openaiSipUriFormat: "sip:{openaiProjectId}@{openaiSipHost};transport=tls",
    telnyxTransfer: {
      sipTransportProtocol: "TLS",
      mediaEncryption: "SRTP",
      timeoutSecs: 45,
    },
    openaiWebhookEvent: "live.transport.incoming",
    openaiWebhookEventAliases: ["live.call.incoming", "realtime.call.incoming"],
    openaiWebhookPath: "/api/openai/live/incoming",
    telnyxWebhookPath: "/api/telnyx/voice/v3-basic",
    liveModel: "gpt-live-1",
    backendModel: "gpt-6-astra",
    liveVoice: "marin",
    webhookSignatureEnv: "OPENAI_WEBHOOK_SECRET",
    requiredEnv: [
      "OPENAI_API_KEY",
      "OPENAI_PROJECT_ID",
      "OPENAI_WEBHOOK_SECRET",
      "TELNYX_API_KEY",
      "APP_URL",
      "DATABASE_URL",
    ],
  };
}

export function resolveProvisioningWebhookUrls(appBaseUrl: string): {
  openai: string;
  telnyx: string;
} {
  const cfg = buildVoiceNumberProvisioningConfig({
    openaiProjectId: "proj_placeholder",
    appBaseUrl,
  });
  const base = appBaseUrl.replace(/\/$/, "");
  return {
    openai: `${base}${cfg.openaiWebhookPath}`,
    telnyx: `${base}${cfg.telnyxWebhookPath}`,
  };
}
