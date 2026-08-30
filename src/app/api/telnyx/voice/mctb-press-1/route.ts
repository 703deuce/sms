import { NextResponse } from "next/server";
import { wrapMctbConsentTexmlBody } from "@/lib/mctb/consent-prompt/texml-response";
import { buildInstantPress1Texml } from "@/lib/mctb/texml-ingress/instant-press1-texml";
import {
  parseMctbTexmlFields,
  pickMctbTexmlField,
} from "@/lib/mctb/texml-ingress/parse-texml-fields";
import { traceMctbTexml } from "@/lib/mctb/texml-ingress/trace";

export const runtime = "nodejs";

const TEXML_CONTENT_TYPE = "text/xml; charset=utf-8";

/**
 * Press-1-only TeXML ingress — zero DB, zero routing profile before first audio.
 */
export async function POST(request: Request) {
  const started = Date.now();
  const requestUrl = new URL(request.url);
  try {
    const fields = await parseMctbTexmlFields(request);
    const to = pickMctbTexmlField(fields, "To", "to", "Called");
    const callSid = pickMctbTexmlField(fields, "CallSid", "call_sid");

    if (!to) {
      return new NextResponse(wrapMctbConsentTexmlBody("<Hangup/>"), {
        status: 200,
        headers: { "Content-Type": TEXML_CONTENT_TYPE },
      });
    }

    const built = buildInstantPress1Texml({
      toE164: to,
      fields,
      routingToken: requestUrl.searchParams.get("r"),
    });

    traceMctbTexml("MCTB_TEXML_RETURNED", {
      source: "mctb-press-1",
      branch: "press_1_only",
      latencyMs: Date.now() - started,
      to,
      callSid,
      routingToken: built.routingToken,
      press1PlayUrl: built.press1PlayUrl,
      instant: true,
      zeroLookup: true,
    });

    return new NextResponse(wrapMctbConsentTexmlBody(built.body), {
      status: 200,
      headers: { "Content-Type": TEXML_CONTENT_TYPE },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ source: "mctb-press-1", event: "handler_error", error: message }));
    return new NextResponse(wrapMctbConsentTexmlBody("<Hangup/>"), {
      status: 200,
      headers: { "Content-Type": TEXML_CONTENT_TYPE },
    });
  }
}

export async function GET() {
  return new NextResponse("ok", { status: 200 });
}
