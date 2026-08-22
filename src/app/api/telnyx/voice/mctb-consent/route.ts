import { NextResponse } from "next/server";
import {
  mctb571ConsentTexmlVoiceUrl,
} from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import { runMctbConsentTexmlDemoCallDetect } from "@/lib/mctb/consent-prompt/texml-inbound-call-event";
import { parseTelnyxForwardedFrom, normalizeForwardedFromE164 } from "@/lib/voice/telnyx/forwarded-from";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function texml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
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

function inboundConsentTexml(forwardedFrom: string) {
  const actionUrl = new URL(mctb571ConsentTexmlVoiceUrl());
  actionUrl.searchParams.set("event", "gather");
  if (forwardedFrom) actionUrl.searchParams.set("forwardedFrom", forwardedFrom);
  const action = actionUrl.toString();
  // Say first — Telnyx edge TTS, no HTTPS fetch. Critical for ~5s carrier forwards.
  const say =
    "Sorry we missed your call. " +
    "To receive a text message from us, press 1 now.";
  return texml(
    `<Gather action="${escapeXml(action)}" method="POST" numDigits="1" timeout="15">` +
      `<Say voice="female">${escapeXml(say)}</Say>` +
      `</Gather><Hangup/>`,
  );
}

/**
 * TeXML voice_url for platform 571 MCTB Press-1.
 * MUST return XML immediately — never await DB before the response (carrier forwards die in ~5s).
 */
export async function POST(request: Request) {
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
      }
    } catch (err) {
      console.error("[mctb-consent-texml] gather handler failed", err);
    }

    return texml(
      `<Say voice="female">Perfect. Check your phone. We have just sent you a message.</Say><Hangup/>`,
    );
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

  if (from) {
    scheduleDemoCallDetect({ from, to, callSid, callStatus, forwardedFrom });
  }

  return inboundConsentTexml(forwardedFrom);
}

export async function GET() {
  return texml(`<Say voice="female">MCTB consent line ready.</Say><Hangup/>`);
}
