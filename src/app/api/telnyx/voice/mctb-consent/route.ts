import { NextResponse } from "next/server";
import { runMctbConsentTexmlDemoCallDetect } from "@/lib/mctb/consent-prompt/texml-inbound-call-event";
import {
  buildMctbConsentControlledHangupTexml,
  buildMctbConsentGatherSuccessTexml,
  buildMctbConsentInboundTexml,
  logMctbConsentTexmlResponseFailed,
  logMctbConsentTexmlResponseReady,
  resolveMctbConsentTexmlPromptMode,
  wrapMctbConsentTexmlBody,
} from "@/lib/mctb/consent-prompt/texml-response";
import { parseTelnyxForwardedFrom, normalizeForwardedFromE164, hasDiversionHeaderInPayload } from "@/lib/voice/telnyx/forwarded-from";
import { businessNumberForConsentStorage } from "@/lib/mctb/consent-identity";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { MCTB_TEXML_CONSENT_PATH } from "@/lib/mctb/texml-ingress/constants";
import {
  certModeSkipsSms,
  certModeUsesTestSms,
  resolveMctbTexmlCertMode,
} from "@/lib/mctb/texml-ingress/cert-mode";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";
import {
  parseMctbTexmlFields,
  pickMctbTexmlField,
} from "@/lib/mctb/texml-ingress/parse-texml-fields";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";

function texml(body: string, branch: Parameters<typeof logMctbConsentTexmlResponseReady>[0]["branch"]) {
  const xml = wrapMctbConsentTexmlBody(body);
  logMctbConsentTexmlResponseReady({
    branch,
    status: 200,
    contentType: TEXML_CONTENT_TYPE,
    xml,
  });
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": TEXML_CONTENT_TYPE },
  });
}

function mctbConsentSmsTriggerSucceeded(sms: unknown): boolean {
  if (!sms || typeof sms !== "object") return false;
  const row = sms as Record<string, unknown>;
  if (row.triggered === true) return true;
  if (row.scheduled === true) return true;
  if (row.deduped === true) return true;
  if (row.ok === true && row.eligible === false) return false;
  if (row.triggered === false || typeof row.reason === "string") return false;
  return row.ok === true;
}

function scheduleDemoCallDetect(input: {
  from: string;
  to: string;
  callSid: string;
  callStatus: string;
  forwardedFrom: string;
}) {
  void runMctbConsentTexmlDemoCallDetect({
    from: input.from,
    to: input.to,
    forwardedFrom: input.forwardedFrom || null,
    callSid: input.callSid || null,
    callStatus: input.callStatus || null,
  }).catch((err) => {
    console.error("[mctb-consent-texml] demo call detect failed", err);
  });
}

/**
 * TeXML voice_url for platform 571 MCTB Press-1.
 * MUST return XML immediately — never await DB before the response (carrier forwards die in ~5s).
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const certMode = resolveMctbTexmlCertMode(url.searchParams.get("cert"));
    const event = url.searchParams.get("event") || "inbound";
    const fields = await parseMctbTexmlFields(request);

    const from = pickMctbTexmlField(fields, "From", "from", "Caller");
    const to = pickMctbTexmlField(fields, "To", "to", "Called");
    const digits = pickMctbTexmlField(fields, "Digits", "digits");
    const callSid = pickMctbTexmlField(fields, "CallSid", "call_sid");
    const callStatus = pickMctbTexmlField(fields, "CallStatus", "call_status");
    const forwardedFrom =
      normalizeForwardedFromE164(url.searchParams.get("forwardedFrom")) ||
      normalizeForwardedFromE164(pickMctbTexmlField(fields, "ForwardedFrom", "forwarded_from")) ||
      parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
      "";
    const hasDiversionHeader = hasDiversionHeaderInPayload(fields as Record<string, unknown>);

    const consentPath =
      url.searchParams.get("path") === MCTB_TEXML_CONSENT_PATH
        ? MCTB_TEXML_CONSENT_PATH
        : "texml_mctb_consent";

    if (event === "gather" && digits && digits !== "1" && from) {
      return texml(
        buildMctbConsentControlledHangupTexml("Thank you. Goodbye."),
        "gather_press_1",
      );
    }

    if (event === "gather" && digits === "1" && from) {
      if (!to) {
        return texml(
          buildMctbConsentControlledHangupTexml("We are unable to complete your call. Goodbye."),
          "gather_press_1",
        );
      }

      traceMctbTexml("MCTB_DTMF_RECEIVED", { from: "[present]", to, callSid, digit: digits });

      console.log(
        JSON.stringify({
          source: "mctb-consent-texml",
          event: "gather_press_1",
          from,
          to,
          callSid,
          forwardedFrom: forwardedFrom || null,
          hasDiversionHeader,
          consentPath,
          certMode,
        }),
      );

      if (!certModeSkipsSms(certMode)) {
        let gatherSucceeded = false;
        let consentRecorded = false;
        try {
          const { resolveMctbTexmlIngressConfig } = await import(
            "@/lib/mctb/texml-ingress/config-cache"
          );
          const ingressConfig = await resolveMctbTexmlIngressConfig(to).catch(() => null);
          if (!ingressConfig?.workspaceId) {
            return texml(
              buildMctbConsentControlledHangupTexml("We are unable to complete your call. Goodbye."),
              "gather_press_1",
            );
          }

          const target = {
            workspaceId: ingressConfig.workspaceId,
            isPlatformDemo: false,
            demoMode: false,
          };
          const certIngressPhoneNumberId = ingressConfig.phoneNumberId;
          const { recordSmsConsent, triggerMissedCallTextFromConsent } = await import(
            "@/lib/smart-routing/consent-service"
          );

          const consentMetadata = {
            path: consentPath,
            callSid,
            forwardedFrom,
            transovoNumberE164: to,
            providerCallId: callSid,
          };

          const consent = await recordSmsConsent({
            workspaceId: target.workspaceId,
            callerNumber: from,
            businessNumber: to,
            transovoIngressE164: to,
            affirmativeInput: "1",
            consentScope: "CUSTOMER_CARE_SMS",
            forwardedFrom: forwardedFrom || null,
            hasDiversionHeader,
            callSessionId: callSid || undefined,
            metadata: consentMetadata,
          });

          traceMctbTexml("MCTB_CONSENT_RECORDED", {
            workspaceId: target.workspaceId,
            callSid,
            duplicate: consent.duplicate,
            verified: consent.identity?.consentIdentityVerified,
          });
          consentRecorded = Boolean(consent.identity?.consentIdentityVerified);

          const allowSms =
            consent.identity?.consentIdentityVerified &&
            (target.demoMode ||
              forwardedFrom ||
              consentPath === MCTB_TEXML_CONSENT_PATH);

          if (allowSms && !consent.duplicate) {
            traceMctbTexml("MCTB_SMS_QUEUED", { workspaceId: target.workspaceId, callSid });
            const sms = await triggerMissedCallTextFromConsent({
              workspaceId: target.workspaceId,
              callerNumber: consent.identity.consentingCallerNumber || from,
              businessNumber: businessNumberForConsentStorage(consent.identity),
              callSessionId: callSid || `texml:${Date.now()}`,
              forwardedFrom: forwardedFrom || null,
              consentIdentityVerified: true,
              phoneNumberId: certIngressPhoneNumberId,
              eventMetadata: {
                ...consentMetadata,
                certMode,
                testSms: certModeUsesTestSms(certMode),
              },
            });
            gatherSucceeded = mctbConsentSmsTriggerSucceeded(sms);
            traceMctbTexml("MCTB_SMS_ACCEPTED", {
              workspaceId: target.workspaceId,
              callSid,
              result: sms,
            });
            console.log(
              JSON.stringify({
                source: "mctb-consent-texml",
                event: "sms_triggered",
                workspaceId: target.workspaceId,
                demoMode: target.demoMode,
                consentPath,
                result: sms,
              }),
            );
          } else if (consent.duplicate && allowSms) {
            gatherSucceeded = true;
          } else if (!consent.identity?.consentIdentityVerified) {
            console.log(
              JSON.stringify({
                source: "mctb-consent-texml",
                event: "sms_skipped",
                workspaceId: target.workspaceId,
                reason: "consent_identity_unverified",
                identityReason: consent.identity?.identityReason ?? null,
                from,
                to,
              }),
            );
          } else if (consent.duplicate) {
            console.log(
              JSON.stringify({
                source: "mctb-consent-texml",
                event: "sms_skipped",
                workspaceId: target.workspaceId,
                reason: "duplicate_consent",
                callSid,
              }),
            );
          } else {
            console.log(
              JSON.stringify({
                source: "mctb-consent-texml",
                event: "sms_skipped",
                workspaceId: target.workspaceId,
                demoMode: target.demoMode,
                reason: "start_try_it_before_calling",
                from,
                to,
              }),
            );
          }
        } catch (err) {
          console.error("[mctb-consent-texml] gather handler failed", err);
        }

        if (!gatherSucceeded && !consentRecorded) {
          return texml(
            buildMctbConsentControlledHangupTexml("Thank you. Goodbye."),
            "gather_press_1",
          );
        }
      }

      const successBody =
        certMode === "B" || certMode === "B3"
          ? `<Say voice="female">Thank you. Press 1 was received.</Say><Hangup/>`
          : buildMctbConsentGatherSuccessTexml();
      return texml(successBody, "gather_press_1");
    }

    console.log(
      JSON.stringify({
        source: "mctb-consent-texml",
        event: "inbound_prompt",
        from,
        to,
        callSid,
        callStatus: callStatus || null,
        forwardedFrom: forwardedFrom || null,
      }),
    );

    try {
      console.log(
        JSON.stringify({
          source: "mctb-consent-texml",
          event: "inbound_build_start",
          from,
          to,
          callSid,
          forwardedFrom: forwardedFrom || null,
        }),
      );

      const promptParam = url.searchParams.get("prompt");
      const promptMode = resolveMctbConsentTexmlPromptMode(promptParam);

      // say-only diagnostic: no Gather/DTMF/DB — isolate Telnyx voice execution on forwarded legs.
      if (promptMode !== "say-only" && from) {
        scheduleDemoCallDetect({ from, to, callSid, callStatus, forwardedFrom });
      }

      const built = buildMctbConsentInboundTexml(forwardedFrom, { promptMode, requestPrompt: promptParam });
      console.log(
        JSON.stringify({
          source: "mctb-consent-texml",
          event: "inbound_built",
          from,
          callSid,
          promptMode: built.promptMode,
          gatherActionUrl: built.gatherActionUrl,
          usesPlay: built.usesPlay,
          usesGather: built.usesGather,
          usesSay: built.usesSay,
          audioUrl: built.audioUrl,
        }),
      );

      const xml = wrapMctbConsentTexmlBody(built.body);
      logMctbConsentTexmlResponseReady({
        branch: "inbound",
        status: 200,
        contentType: TEXML_CONTENT_TYPE,
        xml,
        meta: built,
      });
      return new NextResponse(xml, {
        status: 200,
        headers: { "Content-Type": TEXML_CONTENT_TYPE },
      });
    } catch (inboundErr) {
      logMctbConsentTexmlResponseFailed({
        from,
        to,
        callSid,
        forwardedFrom,
        callStatus,
        error: inboundErr,
        phase: "inbound_response",
      });
      const body = buildMctbConsentControlledHangupTexml(
        "We are unable to complete your call. Goodbye.",
      );
      const xml = wrapMctbConsentTexmlBody(body);
      logMctbConsentTexmlResponseReady({
        branch: "error",
        status: 200,
        contentType: TEXML_CONTENT_TYPE,
        xml,
        meta: {
          error: inboundErr instanceof Error ? inboundErr.message : String(inboundErr),
        },
      });
      return new NextResponse(xml, {
        status: 200,
        headers: { "Content-Type": TEXML_CONTENT_TYPE },
      });
    }
  } catch (err) {
    logMctbConsentTexmlResponseFailed({
      from: "",
      to: "",
      callSid: "",
      forwardedFrom: "",
      callStatus: "",
      error: err,
      phase: "post_handler",
    });
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        source: "mctb-consent-texml",
        event: "handler_error",
        error: message,
      }),
    );
    const body = buildMctbConsentControlledHangupTexml(
      "We are unable to complete your call. Goodbye.",
    );
    const xml = wrapMctbConsentTexmlBody(body);
    logMctbConsentTexmlResponseReady({
      branch: "error",
      status: 200,
      contentType: TEXML_CONTENT_TYPE,
      xml,
      meta: { error: message },
    });
    return new NextResponse(xml, {
      status: 200,
      headers: { "Content-Type": TEXML_CONTENT_TYPE },
    });
  }
}

export async function GET() {
  return texml(`<Say voice="female">MCTB consent line ready.</Say><Hangup/>`, "health");
}
