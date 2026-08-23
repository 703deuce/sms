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
import { parseTelnyxForwardedFrom, normalizeForwardedFromE164 } from "@/lib/voice/telnyx/forwarded-from";

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

async function resolveInboundTarget(input: {
  from: string;
  to: string;
  forwardedFrom: string;
}) {
  const { resolveMctbTargetWorkspaceForInboundCall } = await import(
    "@/lib/mctb/onboarding/demo-workspace-target"
  );
  const ownerId =
    process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";
  return resolveMctbTargetWorkspaceForInboundCall({
    callerE164: input.from,
    businessE164: input.to,
    fallbackWorkspaceId: ownerId,
    forwardedFrom: input.forwardedFrom || null,
  });
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
    const event = url.searchParams.get("event") || "inbound";
    const fields = await parseFields(request);

    const from = pick(fields, "From", "from", "Caller");
    const to = pick(fields, "To", "to", "Called") || "+15714073615";
    const digits = pick(fields, "Digits", "digits");
    const callSid = pick(fields, "CallSid", "call_sid", "CallControlId");
    const callStatus = pick(fields, "CallStatus", "CallStatus", "call_status");
    const forwardedFrom =
      normalizeForwardedFromE164(url.searchParams.get("forwardedFrom")) ||
      normalizeForwardedFromE164(pick(fields, "ForwardedFrom", "forwarded_from")) ||
      parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
      "";

    if (event === "gather" && digits === "1" && from) {
      console.log(
        JSON.stringify({
          source: "mctb-consent-texml",
          event: "gather_press_1",
          from,
          to,
          callSid,
          forwardedFrom: forwardedFrom || null,
        }),
      );

      try {
        const target = await resolveInboundTarget({ from, to, forwardedFrom });
        const { recordSmsConsent, triggerMissedCallTextFromConsent } = await import(
          "@/lib/smart-routing/consent-service"
        );

        await recordSmsConsent({
          workspaceId: target.workspaceId,
          callerNumber: from,
          businessNumber: to,
          affirmativeInput: "1",
          consentScope: "CUSTOMER_CARE_SMS",
          forwardedFrom: forwardedFrom || null,
          metadata: { path: "texml_mctb_consent", callSid, forwardedFrom },
        });

        if (target.demoMode || forwardedFrom) {
          const sms = await triggerMissedCallTextFromConsent({
            workspaceId: target.workspaceId,
            callerNumber: from,
            businessNumber: to,
            callSessionId: callSid || `texml:${Date.now()}`,
            forwardedFrom: forwardedFrom || null,
          });
          console.log(
            JSON.stringify({
              source: "mctb-consent-texml",
              event: "sms_triggered",
              workspaceId: target.workspaceId,
              demoMode: target.demoMode,
              result: sms,
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

      return texml(buildMctbConsentGatherSuccessTexml(), "gather_press_1");
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

      const promptMode = resolveMctbConsentTexmlPromptMode(url.searchParams.get("prompt"));

      // say-only diagnostic: no Gather/DTMF/DB — isolate Telnyx voice execution on forwarded legs.
      if (promptMode !== "say-only" && from) {
        scheduleDemoCallDetect({ from, to, callSid, callStatus, forwardedFrom });
      }

      const built = buildMctbConsentInboundTexml(forwardedFrom, { promptMode });
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
