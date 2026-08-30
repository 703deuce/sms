import { NextResponse } from "next/server";
import { buildInstantVoicemailTexml } from "@/lib/mctb/texml-ingress/instant-voicemail-texml";
import {
  parseMctbTexmlFields,
  pickMctbTexmlField,
} from "@/lib/mctb/texml-ingress/parse-texml-fields";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";
import { wrapMctbConsentTexmlBody } from "@/lib/mctb/consent-prompt/texml-response";

export const runtime = "nodejs";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";

/**
 * Voicemail-only TeXML ingress — zero DB, zero routing profile before first audio.
 * Telnyx voice_url should include ?g=&r= (optional; derived from To E164 if omitted).
 *
 * CALL → construct active.mp3 URL → return TeXML → play → record → [async SaaS]
 */
export async function POST(request: Request) {
  const started = Date.now();
  const requestUrl = new URL(request.url);
  try {
    const fields = await parseMctbTexmlFields(request);
    const to = pickMctbTexmlField(fields, "To", "to", "Called");
    const callSid = pickMctbTexmlField(fields, "CallSid", "call_sid");

    if (!to) {
      return new NextResponse(wrapMctbConsentTexmlBody(`<Hangup/>`), {
        status: 200,
        headers: { "Content-Type": TEXML_CONTENT_TYPE },
      });
    }

    const built = buildInstantVoicemailTexml({
      toE164: to,
      greetingToken: requestUrl.searchParams.get("g"),
      routingToken: requestUrl.searchParams.get("r"),
    });

    traceMctbTexml("MCTB_TEXML_RETURNED", {
      source: "mctb-voicemail",
      branch: "voicemail_only",
      latencyMs: Date.now() - started,
      to,
      callSid,
      greetingToken: built.greetingToken,
      routingToken: built.routingToken,
      voicemailPlayUrl: built.playUrl,
      instant: true,
      zeroLookup: true,
    });

    return new NextResponse(wrapMctbConsentTexmlBody(built.body), {
      status: 200,
      headers: { "Content-Type": TEXML_CONTENT_TYPE },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ source: "mctb-voicemail", event: "handler_error", error: message }));
    return new NextResponse(wrapMctbConsentTexmlBody(`<Hangup/>`), {
      status: 200,
      headers: { "Content-Type": TEXML_CONTENT_TYPE },
    });
  }
}

export async function GET() {
  return new NextResponse("ok", { status: 200 });
}
