import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

export type TexmlVoiceUrlPreflight = {
  url: string;
  ok: boolean;
  status: number;
  contentType: string | null;
  bodyPreview: string;
  isXml: boolean;
  isHtml: boolean;
  latencyMs: number;
  error?: string;
};

/** Verify a TeXML voice_url returns HTTP 200 + XML before pointing Telnyx at it. */
export async function preflightTexmlVoiceUrl(voiceUrl: string): Promise<TexmlVoiceUrlPreflight> {
  const started = Date.now();
  const url = voiceUrl.replace(/\/$/, "");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        From: "+15555550100",
        To: "+18663464256",
        CallSid: `preflight-${Date.now()}`,
      }),
      redirect: "manual",
    });
    const body = await res.text();
    const contentType = res.headers.get("content-type");
    const trimmed = body.trim();
    const isHtml =
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html") ||
      contentType?.includes("text/html") === true;
    const isXml =
      !isHtml &&
      (contentType?.includes("xml") === true ||
        trimmed.startsWith("<?xml") ||
        trimmed.includes("<Response>"));

    return {
      url,
      ok: res.ok && isXml && !isHtml,
      status: res.status,
      contentType,
      bodyPreview: trimmed.slice(0, 500),
      isXml,
      isHtml,
      latencyMs: Date.now() - started,
      error: res.ok && isXml ? undefined : `status=${res.status} html=${isHtml} xml=${isXml}`,
    };
  } catch (err) {
    return {
      url,
      ok: false,
      status: 0,
      contentType: null,
      bodyPreview: "",
      isXml: false,
      isHtml: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function resolveMctbTexmlVoiceUrlCandidates(): {
  entry: string;
  consentSayOnly: string;
  consentMinimal: string;
  consentDefault: string;
} {
  const base = getAppBaseUrl();
  return {
    entry: `${base}/api/telnyx/voice/mctb-entry`,
    consentSayOnly: `${base}/api/telnyx/voice/mctb-consent?prompt=say-only`,
    consentMinimal: `${base}/api/telnyx/voice/mctb-consent?prompt=cert-minimal`,
    consentDefault: `${base}/api/telnyx/voice/mctb-consent`,
  };
}
