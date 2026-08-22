import { NextResponse } from "next/server";
import {
  mctb571ConsentPlaybackUrl,
  mctb571ConsentTexmlVoiceUrl,
} from "@/lib/mctb/consent-prompt/telnyx-texml-route";
import { parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";

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

/**
 * TeXML voice_url for platform 571 MCTB Press-1.
 * Telnyx fetches this when the call arrives — answers and plays without Call Control round trip.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const event = url.searchParams.get("event") || "inbound";
  const fields = await parseFields(request);

  const from = pick(fields, "From", "from", "Caller");
  const to = pick(fields, "To", "to", "Called") || "+15714073615";
  const digits = pick(fields, "Digits", "digits");
  const callSid = pick(fields, "CallSid", "call_sid", "CallControlId");
  const forwardedFrom =
    url.searchParams.get("forwardedFrom")?.trim() ||
    pick(fields, "ForwardedFrom", "forwarded_from") ||
    parseTelnyxForwardedFrom(fields as Record<string, unknown>) ||
    "";

  if (event === "gather" && digits === "1" && from) {
    try {
      const { resolveMctbTargetWorkspaceForInboundCall } = await import(
        "@/lib/mctb/onboarding/demo-workspace-target"
      );
      const { recordSmsConsent, triggerMissedCallTextFromConsent } = await import(
        "@/lib/smart-routing/consent-service"
      );
      const ownerId =
        process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";
      const target = await resolveMctbTargetWorkspaceForInboundCall({
        callerE164: from,
        businessE164: to,
        fallbackWorkspaceId: ownerId,
        forwardedFrom: forwardedFrom || null,
      });

      await recordSmsConsent({
        workspaceId: target.workspaceId,
        callerNumber: from,
        businessNumber: to,
        affirmativeInput: "1",
        consentScope: "CUSTOMER_CARE_SMS",
        metadata: { path: "texml_mctb_consent", callSid, forwardedFrom },
      });

      if (target.demoMode || forwardedFrom) {
        await triggerMissedCallTextFromConsent({
          workspaceId: target.workspaceId,
          callerNumber: from,
          businessNumber: to,
          callSessionId: callSid || `texml:${Date.now()}`,
        });
      }
    } catch (err) {
      console.error("[mctb-consent-texml] gather handler failed", err);
    }

    return texml(
      `<Say voice="female">Perfect. Check your phone. We have just sent you a message.</Say><Hangup/>`,
    );
  }

  const playbackUrl = mctb571ConsentPlaybackUrl();
  const actionUrl = new URL(mctb571ConsentTexmlVoiceUrl());
  actionUrl.searchParams.set("event", "gather");
  if (forwardedFrom) actionUrl.searchParams.set("forwardedFrom", forwardedFrom);
  const action = actionUrl.toString();
  return texml(
    `<Gather action="${escapeXml(action)}" method="POST" numDigits="1" timeout="12">` +
      `<Play>${escapeXml(playbackUrl)}</Play>` +
      `</Gather><Hangup/>`,
  );
}

export async function GET() {
  return texml(`<Say voice="female">MCTB consent line ready.</Say><Hangup/>`);
}
