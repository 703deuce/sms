import { NextResponse } from "next/server";
import { handleMctbEventOnlyTelnyxWebhook } from "@/lib/mctb/event-only/telnyx-handler";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";
import { resolveMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
  };
};

const FALLBACK_WORKSPACE_ID = resolveMctbPlatformOwnerWorkspaceId();

/**
 * Telnyx EVENT_ONLY MCTB: Call Control voice for 571 + FQDN direct 866 (no LiveKit).
 * FQDN path answers via Call Control so forwarded calls stay connected.
 */
export async function POST(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const body = verified.payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  try {
    const result = await handleMctbEventOnlyTelnyxWebhook({
      eventType,
      eventPayload,
      fallbackWorkspaceId: FALLBACK_WORKSPACE_ID,
    });
    return NextResponse.json({
      ok: true,
      source: "mctb-event-only",
      eventType,
      providerEventId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        source: "mctb-event-only",
        event: "handler_error",
        eventType,
        providerEventId,
        error: message,
        callControlId: eventPayload.call_control_id ?? null,
      }),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mctb-event-only",
    flow: "571 + 866 Call Control: answer → press-1 or existing-consent capture → SMS (no LiveKit)",
  });
}
