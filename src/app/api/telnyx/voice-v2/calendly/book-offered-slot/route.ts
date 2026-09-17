import { NextResponse } from "next/server";
import { executeVoiceV2BookOfferedSlot } from "@/lib/voice-v2/book-offered-slot";
import { formatVoiceV2BookTelnyxResponse } from "@/lib/voice-v2/telnyx-book-response";
import { VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE } from "@/lib/voice-v2/telnyx-tool-definition";

/**
 * Telnyx BOOK for wizard bookingStrategy CALENDLY only — not the frozen Microsoft 365 pipeline.
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

  const result = await executeVoiceV2BookOfferedSlot(
    { ...body, call_id: callId, agent_id: agentId },
    workspaceId,
    { agentId },
  );

  if (result.status === "BOOKING_CONFIRMED" && callId) {
    const { patchWorkflowAfterBookConfirmed } = await import("@/lib/voice-v2/booking-workflow-hooks");
    await patchWorkflowAfterBookConfirmed({ callControlId: callId }).catch(() => undefined);
  }

  const payload = formatVoiceV2BookTelnyxResponse(result);

  console.info(
    "[voice-v2/calendly-book-pstn-trace]",
    JSON.stringify({
      status: result.status,
      timing_ms: result.timing_ms,
      offer_set_id: body.offer_set_id,
      selected_slot_id: body.selected_slot_id,
      pipeline: "calendly",
      webhook_ms: Date.now() - ingressStarted,
    }),
  );

  if (callId && workspaceId) {
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    await prisma.auditLog
      .create({
        data: {
          workspaceId,
          event: "voice_v2.pstn_book_trace",
          detail: JSON.stringify({
            callId,
            agentId,
            toolType: toolType || VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
            pipeline: "calendly",
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
    booking_pipeline: "calendly",
    telnyx_to_transovo_ms: Date.now() - ingressStarted,
  });
}
