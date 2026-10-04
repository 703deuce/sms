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
  certModeUsesInstantAnswerPath,
  certModeUsesPlayGather,
  isMinimalCertMode,
  isPlayOnlyCertMode,
  resolveMctbTexmlCertMode,
} from "@/lib/mctb/texml-ingress/cert-mode";
import { buildMctbInstantAnswerTestTexml, certModeUsesZeroDbAnswerTest } from "@/lib/mctb/texml-ingress/answer-test-texml";
import { logMctbEntryTiming } from "@/lib/mctb/texml-ingress/entry-timing";
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
import {
  beginMctbEntryCfnaProbe,
  finishMctbEntryCfnaProbe,
  type MctbEntryProbeHandle,
} from "@/lib/mctb/cfna-ingress-probe";
import { traceMctbPipeline, traceMctbPipelineError } from "@/lib/mctb/pipeline-trace";
import {
  mctbPublicBaseUrlDiagnostics,
  resolveMctbPublicBaseUrl,
} from "@/lib/mctb/texml-ingress/public-base-url";
import { normalizeForwardedFromE164, parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";

export const runtime = "nodejs";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";
const CONTROLLED_HANGUP = buildMctbConsentControlledHangupTexml(
  "We are unable to complete your call. Goodbye.",
);

function texmlResponse(
  body: string,
  meta?: Record<string, unknown>,
  probe?: MctbEntryProbeHandle | null,
  timing?: { callSid?: string | null; to?: string | null; certMode?: string | null },
) {
  const xml = wrapMctbConsentTexmlBody(body);
  const branch = typeof meta?.branch === "string" ? meta.branch : null;
  const latencyMs =
    typeof meta?.latencyMs === "number" ? meta.latencyMs : undefined;

  logMctbEntryTiming({
    phase: "response_complete",
    callSid: timing?.callSid,
    to: timing?.to,
    certMode: timing?.certMode,
    branch,
    extra: {
      responseStatus: 200,
      xmlBytes: Buffer.byteLength(xml, "utf8"),
      latencyMs,
      instant: meta?.instant ?? null,
    },
  });

  if (
    branch === "press_1_gather" ||
    branch === "cert_play_only" ||
    branch === "cert_minimal" ||
    branch === "answer_test_say"
  ) {
    logMctbEntryTiming({
      phase: "gather_start",
      callSid: timing?.callSid,
      to: timing?.to,
      certMode: timing?.certMode,
      branch,
      extra: { note: "TeXML returned with media-generating verb — Telnyx should answer on execute" },
    });
  }

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
  traceMctbPipeline({
    layer: "mctb-entry",
    step: "texml_response",
    outcome: "ok",
    branch: branch,
    xmlBytes: Buffer.byteLength(xml, "utf8"),
    latencyMs,
    ...meta,
  });
  finishMctbEntryCfnaProbe(probe, {
    texmlGenerated: true,
    responseStatus: 200,
    texmlBranch: branch,
    xmlBytes: Buffer.byteLength(xml, "utf8"),
    errorPayload:
      typeof meta?.handlerError === "string" ? { message: meta.handlerError } : null,
  });
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

type EntryTimingCtx = {
  callSid: string | null;
  to: string | null;
  certMode: string;
};

/**
 * TeXML-first MCTB ingress — FROZEN pipeline mctb_texml_final_v1
 * Answer-first: cert D and cert press-1 modes return Gather/Play TeXML with zero DB on the hot path.
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md
 */
export async function POST(request: Request) {
  const started = Date.now();
  const requestUrl = new URL(request.url);
  const publicBaseUrl = resolveMctbPublicBaseUrl(request);
  let entryProbe: MctbEntryProbeHandle | null = null;
  let timingCtx: EntryTimingCtx = { callSid: null, to: null, certMode: "D" };

  traceMctbPipeline({
    layer: "mctb-entry",
    step: "request_received",
    outcome: "ok",
    cert: requestUrl.searchParams.get("cert"),
    publicBaseUrl,
    baseUrlDiagnostics: mctbPublicBaseUrlDiagnostics(request),
  });

  try {
    const fields = await parseMctbTexmlFields(request);
    const from = pickMctbTexmlField(fields, "From", "from", "Caller");
    const to = pickMctbTexmlField(fields, "To", "to", "Called");
    const callSid = pickTexmlCallSid(fields);
    const connectionId = pickMctbTexmlField(fields, "ConnectionId", "connection_id");
    const certMode = resolveMctbTexmlCertMode(requestUrl.searchParams.get("cert"));
    const routingTokenParam = requestUrl.searchParams.get("r");

    timingCtx = { callSid: callSid || null, to: to || null, certMode };

    logMctbEntryTiming({
      phase: "voice_url_arrival",
      callSid: callSid,
      to,
      certMode,
    });
    logMctbEntryTiming({
      phase: "fields_parsed",
      callSid: callSid,
      to,
      certMode,
      extra: { parseMs: Date.now() - started },
    });

    // ── cert=C3 zero-DB answer test: Say only, immediate pickup ─────────────
    if (certModeUsesZeroDbAnswerTest(certMode)) {
      logMctbEntryTiming({
        phase: "texml_build_start",
        callSid,
        to,
        certMode,
        extra: { path: "zero_db_answer_test_say", db: false },
      });
      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: "answer_test_say",
        latencyMs: Date.now() - started,
        to,
        callSid,
        certMode,
        instant: true,
        zeroDb: true,
      });
      traceMctbTexml("MCTB_PROMPT_STARTED", {
        branch: "answer_test_say",
        callSid,
        to,
        certMode,
        instant: true,
        zeroDb: true,
      });
      return texmlResponse(
        buildMctbInstantAnswerTestTexml(),
        { branch: "answer_test_say", certMode, instant: true, zeroDb: true, latencyMs: Date.now() - started },
        null,
        timingCtx,
      );
    }

    entryProbe = beginMctbEntryCfnaProbe({
      payload: { ...fields, connection_id: connectionId, call_control_id: callSid },
      requestUrl: requestUrl.toString(),
      note: "mctb-entry voice_url invoked — programmable TeXML ingress reached",
    });

    const respondTexml = (body: string, meta?: Record<string, unknown>) =>
      texmlResponse(
        body,
        { ...meta, latencyMs: Date.now() - started },
        entryProbe,
        timingCtx,
      );

    traceMctbTexml("MCTB_INGRESS", {
      to,
      from: from ? "[present]" : "[missing]",
      callSid,
      connectionId,
      certMode,
      routingToken: routingTokenParam || null,
      parseMs: Date.now() - started,
    });

    if (isMinimalCertMode(certMode)) {
      traceMctbTexml("MCTB_TEXML_RETURNED", {
        branch: "cert_minimal",
        latencyMs: Date.now() - started,
        to,
        callSid,
      });
      return respondTexml(buildMinimalCertTexml(), { branch: "cert_minimal", certMode });
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
      return respondTexml(buildMctbCertPlayOnlyTexml(publicBaseUrl), {
        branch: "cert_play_only",
        certMode,
        audioUrl,
      });
    }

    if (!to) {
      traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "missing_to_did" });
      return respondTexml(CONTROLLED_HANGUP, { branch: "error_missing_to" });
    }

    const forwardedFrom =
      normalizeForwardedFromE164(pickMctbTexmlField(fields, "ForwardedFrom", "forwarded_from")) ||
      parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
      "";

    // ── Instant answer-first path (cert=D, B, B3, C, C3): zero DB before TeXML ─
    if (certModeUsesInstantAnswerPath(certMode)) {
      logMctbEntryTiming({
        phase: "texml_build_start",
        callSid,
        to,
        certMode,
        extra: { path: "instant" },
      });

      let profile =
        peekMctbInboundRoutingProfileByToken(routingTokenParam) ||
        peekMctbInboundRoutingProfileByE164(to);

      let cacheHit = Boolean(profile);
      if (!profile) {
        const warmed = await warmMctbInboundRoutingProfileForE164(to);
        if (warmed) {
          profile = warmed;
        } else {
          profile = buildFailOpenInboundRoutingProfile(to);
          scheduleInboundWarm(to);
        }
      }

      const instant = buildInstantMctbInboundTexml({
        profile,
        fields,
        certMode,
        publicBaseUrl,
      });
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
              certMode,
            }),
          );
        }

        if (!certModeSkipsConsentBackend(certMode) && from) {
          scheduleDemoCallDetect({
            from,
            to: profile.e164 || to,
            forwardedFrom: forwardedFrom || null,
            callSid: callSid || null,
            callStatus: pickMctbTexmlField(fields, "CallStatus", "call_status") || null,
          });
        }

        traceMctbTexml("MCTB_PROMPT_STARTED", {
          branch: instant.branch,
          callSid,
          to: profile.e164 || to,
          certMode,
          instant: true,
        });

        return respondTexml(instant.body, {
          branch: instant.branch,
          certMode,
          consentMode: profile.consentMode,
          instant: true,
          cacheHit,
        });
      }
    }

    // ── Legacy slow path (unprovisioned / unexpected cert) ───────────────────
    logMctbEntryTiming({
      phase: "texml_build_start",
      callSid,
      to,
      certMode,
      extra: { path: "slow_db" },
    });

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
      return respondTexml(CONTROLLED_HANGUP, { branch: "config_db_error" });
    }

    if (!config) {
      traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "unknown_or_unprovisioned_did", to });
      return respondTexml(CONTROLLED_HANGUP, { branch: "unknown_did" });
    }

    if (config.branch === "ai_assistant" && config.routingMode === "telnyx_assistant") {
      traceMctbTexml("MCTB_ROUTING_FAIL", {
        to,
        reason: "did_still_on_ai_assistant_routing",
        routingMode: config.routingMode,
      });
      return respondTexml(
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
        publicBaseUrl,
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
      return respondTexml(voicemailBody, {
        branch: consentMode === MCTB_CONSENT_MODE_EXISTING ? "existing_consent" : "paused_voicemail",
        consentMode,
        voicemailPlayUrl,
        instant: false,
      });
    }

    const promptMode = certModeUsesPlayGather(certMode)
      ? resolveMctbConsentTexmlPromptMode("play-gather")
      : certMode === "B" || certMode === "C"
        ? resolveMctbConsentTexmlPromptMode("say-gather")
        : resolveMctbConsentTexmlPromptMode(null);

    const playback = await (
      await import("@/lib/mctb/texml-ingress/press1-playback")
    ).resolveMctbPress1TexmlPlayback({ workspaceId });
    if (playback.failClosed) {
      traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "consent_audio_unpublished", workspaceId });
      return respondTexml(CONTROLLED_HANGUP, { branch: "consent_audio_unpublished" });
    }

    const built = buildMctbConsentInboundTexml(forwardedFrom, {
      promptMode,
      gatherBasePath: "mctb-consent",
      certMode: certMode === "D" ? "D" : certMode,
      press1PlayUrl: playback.playUrl,
      press1SayText: playback.sayText,
      publicBaseUrl,
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

    return respondTexml(built.body, {
      branch: "press_1_gather",
      certMode,
      consentMode,
      instant: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    traceMctbPipelineError("mctb-entry", "handler_exception", err, {
      publicBaseUrl,
      cert: requestUrl.searchParams.get("cert"),
    });
    console.error(JSON.stringify({ source: "mctb-entry", event: "handler_error", error: message }));
    traceMctbTexml("MCTB_ROUTING_FAIL", { reason: "handler_exception", error: message });
    return texmlResponse(
      CONTROLLED_HANGUP,
      { branch: "error_fallback", handlerError: message },
      entryProbe,
      timingCtx,
    );
  }
}

export async function GET(request: Request) {
  const publicBaseUrl = resolveMctbPublicBaseUrl(request);
  return NextResponse.json({
    ok: true,
    service: "mctb-entry",
    publicBaseUrl,
    diagnostics: mctbPublicBaseUrlDiagnostics(request),
    cert: resolveMctbTexmlCertMode(new URL(request.url).searchParams.get("cert")),
  });
}
