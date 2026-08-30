const DEFAULT_CONSENT_AUDIO_ASSET_ID = "cmt3o8tyd1o5r0o4k3e4n5v2l";

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    ""
  );
}

function consentTexmlVoiceUrl(segment: "mctb-consent" | "mctb-entry" = "mctb-consent"): string {
  const base = appBaseUrl();
  if (!base) {
    throw new Error(
      "MCTB TeXML requires APP_URL or NEXT_PUBLIC_APP_URL for Gather action URLs",
    );
  }
  return `${base}/api/telnyx/voice/${segment}`;
}

/** Production MCTB Press-1 prerecorded prompt URL (Telnyx &lt;Play&gt;). */
export function getMctbConsentPlaybackUrl(): string {
  const assetId =
    process.env.MCTB_PLATFORM_CONSENT_AUDIO_ASSET_ID?.trim() || DEFAULT_CONSENT_AUDIO_ASSET_ID;
  const base = appBaseUrl();
  const path = `/api/public/smart-routing-audio/${assetId}`;
  return base ? `${base}${path}` : path;
}

export function getMctbConsentAudioAssetId(): string {
  return process.env.MCTB_PLATFORM_CONSENT_AUDIO_ASSET_ID?.trim() || DEFAULT_CONSENT_AUDIO_ASSET_ID;
}

export type MctbConsentTexmlPromptMode = "say-gather" | "say-only" | "play-gather";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function resolveMctbConsentTexmlPromptMode(
  requestPrompt?: string | null,
): MctbConsentTexmlPromptMode {
  const raw = (
    requestPrompt?.trim() ||
    process.env.MCTB_CONSENT_TEXML_PROMPT?.trim() ||
    (process.env.MCTB_CONSENT_TEXML_SAY_ONLY === "1" ? "say-only" : "")
  ).toLowerCase();
  if (raw === "cert-minimal" || raw === "minimal" || raw === "test") return "say-only";
  if (raw === "say-only" || raw === "say") return "say-only";
  if (raw === "play-gather" || raw === "play") return "play-gather";
  return "say-gather";
}

export type MctbConsentInboundTexmlBuild = {
  body: string;
  promptMode: MctbConsentTexmlPromptMode;
  gatherActionUrl: string | null;
  audioUrl: string;
  usesPlay: boolean;
  usesGather: boolean;
  usesSay: boolean;
};

const DEFAULT_SAY =
  "Sorry we missed your call. To receive a text message from us, press 1 now.";

/** Physical forward diagnostic — no Gather, DTMF, DB, or Play. */
export const MCTB_CONSENT_TEXML_SAY_ONLY_DIAGNOSTIC =
  "Transovo test. Your forwarded call reached us successfully.";

export const MCTB_CONSENT_TEXML_CERT_MINIMAL_SAY = "Test successful.";

/** Build inbound Press-1 TeXML without awaiting DB (safe for carrier forward hot path). */
export function buildMctbConsentInboundTexml(
  forwardedFrom: string,
  options?: {
    promptMode?: MctbConsentTexmlPromptMode;
    /** Original ?prompt= query value (cert-minimal, say-only, etc.). */
    requestPrompt?: string | null;
    /** Cert stage — appended to Gather callback (?cert=B) so no env/redeploy needed. */
    certMode?: string | null;
    /** Gather callback route segment (default mctb-consent). */
    gatherBasePath?: "mctb-consent" | "mctb-entry";
  },
): MctbConsentInboundTexmlBuild {
  const requestPrompt = options?.requestPrompt ?? null;
  const promptMode = options?.promptMode ?? resolveMctbConsentTexmlPromptMode(requestPrompt);
  const gatherBasePath = options?.gatherBasePath || "mctb-consent";
  const audioUrl = getMctbConsentPlaybackUrl();

  if (promptMode === "say-only") {
    const rawPrompt = (requestPrompt || process.env.MCTB_CONSENT_TEXML_PROMPT || "").toLowerCase();
    const sayText =
      rawPrompt === "cert-minimal" || rawPrompt === "minimal" || rawPrompt === "test"
        ? MCTB_CONSENT_TEXML_CERT_MINIMAL_SAY
        : MCTB_CONSENT_TEXML_SAY_ONLY_DIAGNOSTIC;
    return {
      body: `<Say voice="female">${escapeXml(sayText)}</Say><Pause length="5"/><Hangup/>`,
      promptMode,
      gatherActionUrl: null,
      audioUrl,
      usesPlay: false,
      usesGather: false,
      usesSay: true,
    };
  }

  const voiceUrl = consentTexmlVoiceUrl(gatherBasePath);
  const actionUrl = new URL(voiceUrl);
  actionUrl.searchParams.set("event", "gather");
  actionUrl.searchParams.set("path", "texml_mctb_ingress");
  if (forwardedFrom) actionUrl.searchParams.set("forwardedFrom", forwardedFrom);
  const cert = options?.certMode?.trim();
  if (cert && cert !== "D") actionUrl.searchParams.set("cert", cert);
  const gatherActionUrl = actionUrl.toString();

  const promptInner =
    promptMode === "play-gather"
      ? `<Play>${escapeXml(audioUrl)}</Play>`
      : `<Say voice="female">${escapeXml(DEFAULT_SAY)}</Say>`;

  return {
    body:
      `<Gather action="${escapeXml(gatherActionUrl)}" method="POST" numDigits="1" timeout="15">` +
      promptInner +
      `</Gather><Hangup/>`,
    promptMode,
    gatherActionUrl,
    audioUrl,
    usesPlay: promptMode === "play-gather",
    usesGather: true,
    usesSay: promptMode === "say-gather",
  };
}

export function buildMctbConsentGatherSuccessTexml(): string {
  return `<Say voice="female">Perfect. Check your phone. We have just sent you a message.</Say><Hangup/>`;
}

export function buildMctbConsentControlledHangupTexml(message: string): string {
  return `<Say voice="female">${escapeXml(message)}</Say><Hangup/>`;
}

/** Cert B2 — Play production consent audio only (no Gather/SMS/DB). */
export function buildMctbCertPlayOnlyTexml(): string {
  const audioUrl = getMctbConsentPlaybackUrl();
  return `<Play>${escapeXml(audioUrl)}</Play><Pause length="2"/><Hangup/>`;
}

/** existing_consent — voicemail greeting only (not press-1 consent audio), then hangup → auto SMS. */
export function buildMctbVoicemailGreetingTexml(input: {
  playUrl: string | null;
  sayText: string | null;
}): string {
  const fallbackSay = "Please leave a message after the tone.";
  if (input.playUrl?.trim()) {
    return `<Play>${escapeXml(input.playUrl.trim())}</Play><Pause length="1"/><Hangup/>`;
  }
  const say = input.sayText?.trim() || fallbackSay;
  return `<Say voice="female">${escapeXml(say)}</Say><Pause length="1"/><Hangup/>`;
}

export function wrapMctbConsentTexmlBody(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

export function logMctbConsentTexmlResponseFailed(input: {
  from: string;
  to: string;
  callSid: string;
  forwardedFrom: string;
  callStatus: string;
  error: unknown;
  phase: string;
}) {
  const err = input.error;
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(
    JSON.stringify({
      source: "mctb-consent-texml",
      event: "response_failed",
      phase: input.phase,
      error: message,
      stack: stack ?? null,
      from: input.from,
      to: input.to,
      forwardedFrom: input.forwardedFrom || null,
      callSid: input.callSid || null,
      callStatus: input.callStatus || null,
    }),
  );
  // Plain-text duplicate for log grep / alerting.
  console.error(
    `[mctb-consent-texml] response_failed phase=${input.phase} error=${message} from=${input.from} to=${input.to} forwardedFrom=${input.forwardedFrom} callSid=${input.callSid}`,
  );
}

export function logMctbConsentTexmlResponseReady(input: {
  branch: "inbound" | "gather_press_1" | "health" | "error";
  status: number;
  contentType: string;
  xml: string;
  meta?: Partial<MctbConsentInboundTexmlBuild> & {
    consentMode?: string | null;
    audioReachable?: boolean | null;
    error?: string;
  };
}) {
  console.log(
    JSON.stringify({
      source: "mctb-consent-texml",
      event: "response_ready",
      branch: input.branch,
      status: input.status,
      contentType: input.contentType,
      xmlBytes: Buffer.byteLength(input.xml, "utf8"),
      promptMode: input.meta?.promptMode ?? null,
      consentMode: input.meta?.consentMode ?? null,
      gatherActionUrl: input.meta?.gatherActionUrl ?? null,
      audioUrl: input.meta?.audioUrl ?? null,
      usesPlay: input.meta?.usesPlay ?? null,
      usesGather: input.meta?.usesGather ?? null,
      usesSay: input.meta?.usesSay ?? null,
      audioReachable: input.meta?.audioReachable ?? null,
      error: input.meta?.error ?? null,
      xmlPreview: input.xml.slice(0, 500),
    }),
  );
}
