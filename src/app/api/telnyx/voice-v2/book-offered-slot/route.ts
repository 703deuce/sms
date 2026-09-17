import { NextResponse } from "next/server";
import { executeMicrosoft365CertifiedBookOfferedSlot } from "@/lib/voice-v2/pipelines/microsoft-365-certified";
import { formatVoiceV2BookTelnyxResponse } from "@/lib/voice-v2/telnyx-book-response";
import { VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

/**
 * Telnyx webhook — Microsoft 365 certified BOOK only (06125f5f pipeline).
 */
export async function POST(request: Request) {
  const ingressStarted = Date.now();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const workspaceId = request.headers.get("x-transovo-workspace-id")?.trim() || "";
  const agentId = request.headers.get("x-transovo-agent-id")?.trim() || "";
  const toolType = request.headers.get("x-transovo-tool-type")?.trim() || "";

  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, speak: "Workspace missing.", error: "workspace_required" },
      { status: 200 },
    );
  }
  if (toolType && toolType !== VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE) {
    return NextResponse.json(
      { ok: false, speak: "Wrong tool.", error: "tool_type_mismatch" },
      { status: 200 },
    );
  }

  const callId =
    String(body.call_id || body.callId || request.headers.get("x-telnyx-call-control-id") || "") ||
    null;

  if (agentId && callId) {
    const { evaluateBookingIntakeGate } = await import("@/lib/voice-v2/intake/booking-gate");
    const { resolveSessionKey } = await import("@/lib/voice-v2/intake/load-call-context");
    const { getVoiceV2CallContext } = await import("@/lib/voice-v2/intake/session-store");
    const { speakForMissingBeforeBookingFields } = await import(
      "@/lib/voice-v2/intake/missing-field-speak"
    );
    const gate = await evaluateBookingIntakeGate({
      workspaceId,
      agentId,
      callControlId: callId,
      conversationId: String(body.conversation_id || body.telnyx_conversation_id || ""),
      fromE164: String(body.from || body.caller || ""),
    });
    if (!gate.allowed) {
      const sk = resolveSessionKey({
        callControlId: callId,
        conversationId: String(body.conversation_id || body.telnyx_conversation_id || ""),
      });
      const ctx = sk ? getVoiceV2CallContext(sk) : null;
      const speak = ctx
        ? speakForMissingBeforeBookingFields(ctx.intakeSchema, gate.missing_fields)
        : undefined;
      const ms = Date.now() - ingressStarted;
      const payload = formatVoiceV2BookTelnyxResponse({
        status: "MISSING_REQUIRED_FIELDS",
        missing_fields: gate.missing_fields,
        error: "missing_required_intake_fields",
        speak,
        timing_ms: {
          OFFER_RESOLUTION_MS: 0,
          REVALIDATION_MS: 0,
          TOKEN_MS: 0,
          GRAPH_CREATE_MS: 0,
          TOTAL_BACKEND_MS: ms,
        },
      });
      return NextResponse.json({
        ...payload,
        call_id: callId,
        booking_pipeline: "microsoft_365_certified",
        telnyx_to_transovo_ms: ms,
      });
    }
  }

  const result = await executeMicrosoft365CertifiedBookOfferedSlot(
    { ...body, call_id: callId },
    workspaceId,
  );
  const payload = formatVoiceV2BookTelnyxResponse(result);

  console.info(
    "[voice-v2/book-pstn-trace]",
    JSON.stringify({
      status: result.status,
      timing_ms: result.timing_ms,
      offer_set_id: body.offer_set_id,
      selected_slot_id: body.selected_slot_id,
      pipeline: "microsoft-365-certified",
      webhook_ms: Date.now() - ingressStarted,
    }),
  );

  if (callId && workspaceId) {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    void prisma.auditLog
      .create({
        data: {
          workspaceId,
          event: "voice_v2.pstn_book_trace",
          detail: JSON.stringify({
            callId,
            agentId,
            toolType: toolType || VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
            pipeline: "microsoft_365_certified",
            resultStatus: result.status,
            offer_set_id: body.offer_set_id,
            selected_slot_id: body.selected_slot_id,
            timing_ms: result.timing_ms,
          }),
        },
      })
      .catch(() => undefined);
  }

  return NextResponse.json({
    ...payload,
    call_id: callId,
    booking_pipeline: "microsoft_365_certified",
    telnyx_to_transovo_ms: Date.now() - ingressStarted,
  });
}
