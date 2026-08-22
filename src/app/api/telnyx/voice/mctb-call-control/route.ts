import { NextResponse } from "next/server";
import { handleMctbCallControlDiagnosticEvent } from "@/lib/mctb/consent-prompt/call-control-diagnostic";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
  };
};

/**
 * Isolated Telnyx Call Control webhook for MCTB 571 diagnostic.
 * Separate from TeXML and from /api/telnyx/voice.
 */
export async function POST(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const body = verified.payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  try {
    const result = await handleMctbCallControlDiagnosticEvent({ eventType, eventPayload });
    return NextResponse.json({
      ok: true,
      source: "mctb-call-control",
      eventType,
      providerEventId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(
      JSON.stringify({
        source: "mctb-call-control",
        event: "handler_error",
        eventType,
        providerEventId,
        error: message,
        stack: stack ?? null,
        callControlId: eventPayload.call_control_id ?? null,
      }),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mctb-call-control-diagnostic",
    flow: "call.initiated → answer → call.answered → speak → call.speak.ended → hangup",
  });
}
