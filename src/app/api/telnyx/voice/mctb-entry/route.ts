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
import { resolveMctbPress1TexmlPlayback } from "@/lib/mctb/texml-ingress/press1-playback";
import { ensureMctbTexmlVoicemailSession } from "@/lib/mctb/texml-ingress/voicemail-start";
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
const CONTROLLED_HANGUP = buildMctbConsentControlledHangupTexml(
  "We are unable to complete your call. Goodbye.",
);

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

function pickTexmlCallSid(fields: Record<string, string>): string {
  return (
    fields.CallSid?.trim() ||
    fields.call_sid?.trim() ||
    ""
  );
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
 * TeXML-first MCTB ingress — FROZEN pipeline mctb_texml_final_v1
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md — do not change behavior without re-cert.
 */
export async function POST(request: Request) {
  const started = Date.now();
  const requestUrl = new URL(request.url);
  try {
    const fields = await parseFields(request);
    const from = pick(fields, "From", "from", "Caller");
    const to = pick(fields, "To", "to", "Called");
    const callSid = pickTexmlCallSid(fields);
    const connectionId = pick(fields, "ConnectionId", "connection_id");
    const certMode = resolveMctbTexmlCertMode(requestUrl.searchParams.get("cert"));

    traceMctbTexml("MCTB_INGRESS", {
      to,
      from: from ? "[present]" : "[missing]",
      callSid,
      connectionId,
      certMode,
    });

    if (isMinimalCertMode(certMode)) {
      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: "cert_minimal",
        latencyMs: Date.now() - started,
        to,
        callSid,
      });
      return texmlResponse(buildMinimalCertTexml(), { branch: "cert_minimal", certMode });
    }

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
      return texmlResponse(CONTROLLED_HANGUP, { branch: "error_missing_to" });
    }

    const config = await resolveMctbTexmlIngressConfig(to).catch(() => null);

    if (!config) {
      traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "unknown_or_unprovisioned_did", to });
      return texmlResponse(CONTROLLED_HANGUP, { branch: "unknown_did" });
    }

    if (config.branch === "ai_assistant" && config.routingMode === "telnyx_assistant") {
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

    const consentMode = config.consentMode;
    const workspaceId = config.workspaceId;
    const resolvedTo = config.e164;
    const forwardedFrom =
      normalizeForwardedFromE164(pick(fields, "ForwardedFrom", "forwarded_from")) ||
      parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
      "";

    const schedulePromise =
      consentMode !== MCTB_CONSENT_MODE_EXISTING && !certModeForcesPress1Gather(certMode)
        ? (async () => {
            const { loadMissedCallTextConfig } = await import(
              "@/lib/agents/missed-call-text-back/config"
            );
            const { loadMctbScheduleSettings, isMctbAutomationActive } = await import(
              "@/lib/mctb/schedule"
            );
            const runtimeConfig = await loadMissedCallTextConfig(workspaceId);
            const scheduleSettings = await loadMctbScheduleSettings(workspaceId, runtimeConfig);
            return isMctbAutomationActive(scheduleSettings, runtimeConfig);
          })()
        : Promise.resolve(true);

    const press1PlaybackPromise =
      consentMode !== MCTB_CONSENT_MODE_EXISTING &&
      !certModeSkipsConsentBackend(certMode)
        ? resolveMctbPress1TexmlPlayback({ workspaceId }).catch(() => null)
        : Promise.resolve(null);

    const voicemailPlaybackPromise =
      consentMode === MCTB_CONSENT_MODE_EXISTING || certModeForcesPress1Gather(certMode)
        ? Promise.resolve(null)
        : (async () => {
            const automationActive = await schedulePromise;
            if (automationActive) return null;
            const { resolveMctbVoicemailFallbackPlayback } = await import(
              "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback"
            );
            return resolveMctbVoicemailFallbackPlayback(workspaceId, resolvedTo);
          })();

    const [automationActive, press1Playback, pausedVoicemailPlayback] = await Promise.all([
      schedulePromise,
      press1PlaybackPromise,
      voicemailPlaybackPromise,
    ]);

    let routeToVoicemail = consentMode === MCTB_CONSENT_MODE_EXISTING;
    if (!routeToVoicemail && !certModeForcesPress1Gather(certMode) && !automationActive) {
      routeToVoicemail = true;
    }

    if (routeToVoicemail && !certModeForcesPress1Gather(certMode)) {
      let voicemailBody = buildMctbVoicemailGreetingTexml({ playUrl: null, sayText: null });
      let voicemailPlayUrl: string | null = null;

      if (consentMode === MCTB_CONSENT_MODE_EXISTING) {
        const { resolveMctbVoicemailFallbackPlayback } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback"
        );
        const playback = await resolveMctbVoicemailFallbackPlayback(workspaceId, resolvedTo);
        voicemailPlayUrl = playback.playUrl;
        voicemailBody = buildMctbVoicemailGreetingTexml(playback);
      } else if (pausedVoicemailPlayback) {
        voicemailPlayUrl = pausedVoicemailPlayback.playUrl;
        voicemailBody = buildMctbVoicemailGreetingTexml(pausedVoicemailPlayback);
      }

      if (from && callSid) {
        void ensureMctbTexmlVoicemailSession({
          callSid,
          workspaceId,
          callerE164: from,
          transovoNumberE164: resolvedTo,
          forwardedFromE164: forwardedFrom || null,
        }).catch(() => undefined);
      }

      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: consentMode === MCTB_CONSENT_MODE_EXISTING ? "existing_consent" : "paused_voicemail",
        latencyMs: Date.now() - started,
        to: resolvedTo,
        callSid,
        routingMode: config.routingMode || MCTB_TEXML_ROUTING_MODE,
        consentMode,
        workspaceId,
        voicemailPlayUrl,
      });
      return texmlResponse(voicemailBody, {
        branch: consentMode === MCTB_CONSENT_MODE_EXISTING ? "existing_consent" : "paused_voicemail",
        consentMode,
        voicemailPlayUrl,
      });
    }

    if (press1Playback?.failClosed) {
      return texmlResponse(CONTROLLED_HANGUP, { branch: "press1_playback_fail_closed" });
    }

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
      certMode: certMode === "D" ? "D" : certMode,
      press1PlayUrl: press1Playback?.playUrl ?? null,
      press1SayText: press1Playback?.sayText ?? null,
    });

    traceMctbTexml("MCTB_TEXML_RETURNED", {
      branch: "press_1_gather",
      latencyMs: Date.now() - started,
      to: resolvedTo,
      callSid,
      certMode,
      usesGather: built.usesGather,
      consentMode,
      workspaceId,
      routingMode: config.routingMode,
    });

    if (!certModeSkipsConsentBackend(certMode) && from) {
      void import("@/lib/mctb/consent-prompt/texml-inbound-call-event").then(
        ({ runMctbConsentTexmlDemoCallDetect }) =>
          runMctbConsentTexmlDemoCallDetect({
            from,
            to: resolvedTo,
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
    return texmlResponse(CONTROLLED_HANGUP, { branch: "error_fallback" });
  }
}

export async function GET() {
  return texmlResponse(buildMinimalCertTexml(), { branch: "health" });
}
