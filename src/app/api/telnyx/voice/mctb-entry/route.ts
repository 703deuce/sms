import { NextResponse } from "next/server";
import {
  buildMctbCertPlayOnlyTexml,
  buildMctbConsentControlledHangupTexml,
  buildMctbConsentInboundTexml,
  getMctbConsentPlaybackUrl,
  resolveMctbConsentTexmlPromptMode,
  wrapMctbConsentTexmlBody,
} from "@/lib/mctb/consent-prompt/texml-response";
import {
  certModeForcesPress1Gather,
  certModeSkipsConsentBackend,
  certModeUsesPlayGather,
  isMinimalCertMode,
  isPlayOnlyCertMode,
  resolveMctbTexmlCertMode,
} from "@/lib/mctb/texml-ingress/cert-mode";
import { buildInstantMctbInboundTexml } from "@/lib/mctb/texml-ingress/inbound-texml";
import { buildMinimalCertTexml } from "@/lib/mctb/texml-ingress/minimal-texml";
import {
  parseMctbTexmlFields,
  pickMctbTexmlField,
} from "@/lib/mctb/texml-ingress/parse-texml-fields";
import {
  buildFailOpenInboundRoutingProfile,
  peekMctbInboundRoutingProfileByE164,
  peekMctbInboundRoutingProfileByToken,
  warmMctbInboundRoutingProfileForE164,
} from "@/lib/mctb/texml-ingress/routing-profile";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";
import { normalizeForwardedFromE164, parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";

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
  return pickMctbTexmlField(fields, "CallSid", "call_sid");
}

function scheduleInboundWarm(e164: string): void {
  void warmMctbInboundRoutingProfileForE164(e164).catch((err) => {
    console.error(
      JSON.stringify({
        source: "mctb-entry",
        event: "routing_profile_warm_failed",
        e164,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  });
}

function scheduleDemoCallDetect(input: {
  from: string;
  to: string;
  forwardedFrom: string | null;
  callSid: string | null;
  callStatus: string | null;
}): void {
  void import("@/lib/mctb/consent-prompt/texml-inbound-call-event").then(
    ({ runMctbConsentTexmlDemoCallDetect }) =>
      runMctbConsentTexmlDemoCallDetect({
        from: input.from,
        to: input.to,
        forwardedFrom: input.forwardedFrom,
        callSid: input.callSid,
        callStatus: input.callStatus,
      }).catch(() => undefined),
  );
}

/**
 * TeXML-first MCTB ingress — FROZEN pipeline mctb_texml_final_v1
 * Production cert=D returns XML immediately from setup-time routing profile (no DB).
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md
 */
export async function POST(request: Request) {
  const started = Date.now();
  const requestUrl = new URL(request.url);
  try {
    const fields = await parseMctbTexmlFields(request);
    const from = pickMctbTexmlField(fields, "From", "from", "Caller");
    const to = pickMctbTexmlField(fields, "To", "to", "Called");
    const callSid = pickTexmlCallSid(fields);
    const connectionId = pickMctbTexmlField(fields, "ConnectionId", "connection_id");
    const certMode = resolveMctbTexmlCertMode(requestUrl.searchParams.get("cert"));
    const routingTokenParam = requestUrl.searchParams.get("r");

    traceMctbTexml("MCTB_INGRESS", {
      to,
      from: from ? "[present]" : "[missing]",
      callSid,
      connectionId,
      certMode,
      routingToken: routingTokenParam || null,
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

    const forwardedFrom =
      normalizeForwardedFromE164(pickMctbTexmlField(fields, "ForwardedFrom", "forwarded_from")) ||
      parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
      "";

    // ── Instant path (cert=D): zero DB before first audio ──────────────────
    if (certMode === "D") {
      let profile =
        peekMctbInboundRoutingProfileByToken(routingTokenParam) ||
        peekMctbInboundRoutingProfileByE164(to);

      let cacheHit = Boolean(profile);
      if (!profile) {
        profile = buildFailOpenInboundRoutingProfile(to);
        scheduleInboundWarm(to);
      }

      const instant = buildInstantMctbInboundTexml({ profile, fields, certMode });
      if (instant) {
        traceMctbTexml("MCTB_TEXML_RETURNED", {
          branch: instant.branch,
          latencyMs: Date.now() - started,
          to: profile.e164 || to,
          callSid,
          certMode,
          cacheHit,
          routingToken: instant.routingToken,
          workspaceId: profile.workspaceId || null,
          press1PlayUrl: instant.press1PlayUrl ?? null,
          voicemailPlayUrl: instant.voicemailPlayUrl ?? null,
          instant: true,
        });

        if (!cacheHit) {
          console.log(
            JSON.stringify({
              source: "mctb-entry",
              event: "routing_profile_cache_miss_fail_open",
              to,
              callSid,
            }),
          );
        }

        if (!certModeSkipsConsentBackend(certMode) && from && profile.workspaceId) {
          scheduleDemoCallDetect({
            from,
            to: profile.e164 || to,
            forwardedFrom: forwardedFrom || null,
            callSid: callSid || null,
            callStatus: pickMctbTexmlField(fields, "CallStatus", "call_status") || null,
          });
        }

        return texmlResponse(instant.body, {
          branch: instant.branch,
          certMode,
          consentMode: profile.consentMode,
          instant: true,
          cacheHit,
        });
      }
    }

    // ── Cert / legacy slow path (B, C, C3, cache-miss non-D) ───────────────
    const { resolveMctbTexmlIngressConfig } = await import("@/lib/mctb/texml-ingress/config-cache");
    const { MCTB_CONSENT_MODE_EXISTING } = await import("@/lib/mctb/consent-mode");
    const { MCTB_TEXML_ROUTING_MODE } = await import("@/lib/mctb/texml-ingress/constants");
    const { buildMctbVoicemailGreetingTexml } = await import("@/lib/mctb/consent-prompt/texml-response");
    const { getMctbVoicemailRecordCallbackWithRoutingToken } = await import(
      "@/lib/mctb/texml-ingress/routing-profile"
    );

    let config: Awaited<ReturnType<typeof resolveMctbTexmlIngressConfig>> | null = null;
    try {
      config = await resolveMctbTexmlIngressConfig(to);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "config_db_error", error: message, to });
      return texmlResponse(CONTROLLED_HANGUP, { branch: "config_db_error" });
    }

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

    const routeToVoicemailInitial =
      consentMode === MCTB_CONSENT_MODE_EXISTING || certModeForcesPress1Gather(certMode);

    let automationActive = true;
    if (!routeToVoicemailInitial && !certModeForcesPress1Gather(certMode)) {
      const { loadMissedCallTextConfig } = await import(
        "@/lib/agents/missed-call-text-back/config"
      );
      const { loadMctbScheduleSettings, isMctbAutomationActive } = await import(
        "@/lib/mctb/schedule"
      );
      const runtimeConfig = await loadMissedCallTextConfig(workspaceId);
      const scheduleSettings = await loadMctbScheduleSettings(workspaceId, runtimeConfig);
      automationActive = isMctbAutomationActive(scheduleSettings, runtimeConfig);
    }

    let routeToVoicemail = routeToVoicemailInitial;
    if (!routeToVoicemail && !certModeForcesPress1Gather(certMode) && !automationActive) {
      routeToVoicemail = true;
    }

    if (routeToVoicemail && !certModeForcesPress1Gather(certMode)) {
      const cachedProfile = peekMctbInboundRoutingProfileByE164(resolvedTo);
      const voicemailPlayUrl =
        cachedProfile?.voicemail.playUrl ||
        (await import("@/lib/mctb/texml-ingress/routing-profile")).platformVoicemailPlayUrl();
      const recordToken = cachedProfile?.routingToken || "r_failopen";
      const voicemailBody = buildMctbVoicemailGreetingTexml({
        playUrl: voicemailPlayUrl,
        sayText: null,
        recordCallbackUrl: getMctbVoicemailRecordCallbackWithRoutingToken(recordToken),
      });

      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: consentMode === MCTB_CONSENT_MODE_EXISTING ? "existing_consent" : "paused_voicemail",
        latencyMs: Date.now() - started,
        to: resolvedTo,
        callSid,
        routingMode: config.routingMode || MCTB_TEXML_ROUTING_MODE,
        consentMode,
        workspaceId,
        voicemailPlayUrl,
        instant: false,
      });
      return texmlResponse(voicemailBody, {
        branch: consentMode === MCTB_CONSENT_MODE_EXISTING ? "existing_consent" : "paused_voicemail",
        consentMode,
        voicemailPlayUrl,
      });
    }

    const promptMode = certModeUsesPlayGather(certMode)
      ? resolveMctbConsentTexmlPromptMode("play-gather")
      : certMode === "B" || certMode === "C"
        ? resolveMctbConsentTexmlPromptMode("say-gather")
        : certMode === "D"
          ? resolveMctbConsentTexmlPromptMode("play-gather")
          : resolveMctbConsentTexmlPromptMode(null);

    const playback = await (
      await import("@/lib/mctb/texml-ingress/press1-playback")
    ).resolveMctbPress1TexmlPlayback({ workspaceId });
    if (playback.failClosed) {
      traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "consent_audio_unpublished", workspaceId });
      return texmlResponse(CONTROLLED_HANGUP, { branch: "consent_audio_unpublished" });
    }

    const built = buildMctbConsentInboundTexml(forwardedFrom, {
      promptMode,
      gatherBasePath: "mctb-consent",
      certMode: certMode === "D" ? "D" : certMode,
      press1PlayUrl: playback.playUrl,
      press1SayText: playback.sayText,
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
      press1PlayUrl: playback.playUrl,
      press1SayFallback: Boolean(playback.sayText),
      instant: false,
    });

    if (!certModeSkipsConsentBackend(certMode) && from) {
      scheduleDemoCallDetect({
        from,
        to: resolvedTo,
        forwardedFrom: forwardedFrom || null,
        callSid: callSid || null,
        callStatus: pickMctbTexmlField(fields, "CallStatus", "call_status") || null,
      });
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
