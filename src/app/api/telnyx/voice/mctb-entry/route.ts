import { NextResponse } from "next/server";
import {
  buildMctbCertPlayOnlyTexml,
  buildMctbConsentControlledHangupTexml,
  buildMctbConsentInboundTexml,
  buildMctbVoicemailGreetingTexml,
  getMctbConsentPlaybackUrl,
  resolveMctbConsentTexmlPromptMode,
  wrapMctbConsentTexmlBody,
} from "@/lib/mctb/consent-prompt/texml-response";
import { MCTB_CONSENT_MODE_EXISTING } from "@/lib/mctb/consent-mode";
import {
  certModeForcesPress1Gather,
  certModeSkipsConsentBackend,
  certModeUsesPlayGather,
  isMinimalCertMode,
  isPlayOnlyCertMode,
  resolveMctbTexmlCertMode,
} from "@/lib/mctb/texml-ingress/cert-mode";
import { resolveMctbTexmlIngressConfig } from "@/lib/mctb/texml-ingress/config-cache";
import { MCTB_TEXML_ROUTING_MODE } from "@/lib/mctb/texml-ingress/constants";
import { buildMinimalCertTexml } from "@/lib/mctb/texml-ingress/minimal-texml";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";
import { parseTelnyxForwardedFrom, normalizeForwardedFromE164 } from "@/lib/voice/telnyx/forwarded-from";

export const runtime = "nodejs";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";

function texmlResponse(body: string, meta?: Record<string, unknown>) {
  const xml = wrapMctbConsentTexmlBody(body);
  console.log(
    JSON.stringify({
      source: "mctb-entry",
      event: "texml_response",
      status: 200,
      contentType: TEXML_CONTENT_TYPE,
      xmlBytes: Buffer.byteLength(xml, "utf8"),
      xmlPreview: xml.slice(0, 400),
      ...meta,
    }),
  );
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": TEXML_CONTENT_TYPE },
  });
}

async function parseFields(request: Request): Promise<Record<string, string>> {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(json)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  const form = await request.formData().catch(() => new FormData());
  const out: Record<string, string> = {};
  form.forEach((value, key) => {
    out[key] = String(value);
  });
  return out;
}

function pick(fields: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = fields[key];
    if (val?.trim()) return val.trim();
  }
  return "";
}

/**
 * TeXML-first MCTB ingress — same Telnyx front door as proven AI path.
 * Certification modes return XML immediately with zero DB.
 */
export async function POST(request: Request) {
  const started = Date.now();
  const requestUrl = new URL(request.url);
  try {
    const fields = await parseFields(request);
    const from = pick(fields, "From", "from", "Caller");
    const to = pick(fields, "To", "to", "Called");
    const callSid = pick(fields, "CallSid", "call_sid", "CallControlId");
    const connectionId = pick(fields, "ConnectionId", "connection_id");
    const certMode = resolveMctbTexmlCertMode(requestUrl.searchParams.get("cert"));

    traceMctbTexml("MCTB_INGRESS", {
      to,
      from: from ? "[present]" : "[missing]",
      callSid,
      connectionId,
      certMode,
    });

    // MINIMAL / A — zero DB, zero branching. Proves TeXML ingress only.
    if (isMinimalCertMode(certMode)) {
      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: "cert_minimal",
        latencyMs: Date.now() - started,
        to,
        callSid,
      });
      return texmlResponse(buildMinimalCertTexml(), { branch: "cert_minimal", certMode });
    }

    // B2 — Play production consent audio only (isolates Telnyx &lt;Play&gt; media fetch).
    if (isPlayOnlyCertMode(certMode)) {
      const audioUrl = getMctbConsentPlaybackUrl();
      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: "cert_play_only",
        latencyMs: Date.now() - started,
        to,
        callSid,
        audioUrl,
      });
      return texmlResponse(buildMctbCertPlayOnlyTexml(), {
        branch: "cert_play_only",
        certMode,
        audioUrl,
      });
    }

    if (!to) {
      traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "missing_to_did" });
      return texmlResponse(buildMctbConsentControlledHangupTexml("We are unable to complete your call. Goodbye."), {
        branch: "error_missing_to",
      });
    }

    const config = await resolveMctbTexmlIngressConfig(to).catch(() => null);

    if (config?.branch === "ai_assistant" && config.routingMode === "telnyx_assistant") {
      traceMctbTexml("MCTB_ROUTING_FAIL", {
        to,
        reason: "did_still_on_ai_assistant_routing",
        routingMode: config.routingMode,
      });
      return texmlResponse(
        buildMctbConsentControlledHangupTexml(
          "This line is configured for AI receptionist routing. Goodbye.",
        ),
        { branch: "ai_assistant_blocked" },
      );
    }

    const consentMode = config?.consentMode || "press_1";

    if (consentMode === MCTB_CONSENT_MODE_EXISTING && !certModeForcesPress1Gather(certMode)) {
      const workspaceId = config?.workspaceId;
      let voicemailBody = buildMctbVoicemailGreetingTexml({ playUrl: null, sayText: null });
      let voicemailPlayUrl: string | null = null;
      if (workspaceId) {
        const { resolveMctbVoicemailFallbackPlayback } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback"
        );
        const playback = await resolveMctbVoicemailFallbackPlayback(workspaceId, to);
        voicemailPlayUrl = playback.playUrl;
        voicemailBody = buildMctbVoicemailGreetingTexml(playback);
      }
      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: "existing_consent",
        latencyMs: Date.now() - started,
        to,
        callSid,
        routingMode: config?.routingMode || MCTB_TEXML_ROUTING_MODE,
        consentMode,
        workspaceId,
        voicemailPlayUrl,
      });
      return texmlResponse(voicemailBody, {
        branch: "existing_consent",
        consentMode,
        voicemailPlayUrl,
      });
    }

    const forwardedFrom =
      normalizeForwardedFromE164(pick(fields, "ForwardedFrom", "forwarded_from")) ||
      parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
      "";

    const promptMode = certModeUsesPlayGather(certMode)
      ? resolveMctbConsentTexmlPromptMode("play-gather")
      : certMode === "B" || certMode === "C"
        ? resolveMctbConsentTexmlPromptMode("say-gather")
        : certMode === "D"
          ? resolveMctbConsentTexmlPromptMode("play-gather")
          : resolveMctbConsentTexmlPromptMode(null);

    const built = buildMctbConsentInboundTexml(forwardedFrom, {
      promptMode,
      gatherBasePath: "mctb-consent",
      certMode: certMode === "D" ? null : certMode,
    });

    traceMctbTexml("MCTB_TEXML_RETURNED", {
      branch: "press_1_gather",
      latencyMs: Date.now() - started,
      to,
      callSid,
      certMode,
      usesGather: built.usesGather,
      consentMode,
      workspaceId: config?.workspaceId,
      routingMode: config?.routingMode,
    });

    if (!certModeSkipsConsentBackend(certMode) && from && config?.workspaceId) {
      void import("@/lib/mctb/consent-prompt/texml-inbound-call-event").then(
        ({ runMctbConsentTexmlDemoCallDetect }) =>
          runMctbConsentTexmlDemoCallDetect({
            from,
            to,
            forwardedFrom: forwardedFrom || null,
            callSid: callSid || null,
            callStatus: pick(fields, "CallStatus", "call_status") || null,
          }).catch(() => undefined),
      );
    }

    return texmlResponse(built.body, { branch: "press_1_gather", certMode, consentMode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ source: "mctb-entry", event: "handler_error", error: message }));
    traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "handler_exception", error: message });
    return texmlResponse(buildMinimalCertTexml(), { branch: "error_fallback" });
  }
}

export async function GET() {
  return texmlResponse(buildMinimalCertTexml(), { branch: "health" });
}
