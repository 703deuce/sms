import { NextResponse } from "next/server";
import { verifyVoiceRuntimeInternalAuth } from "@/lib/voice/python-runtime-bridge/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoiceRuntimeAction =
  | "bootstrap_inbound"
  | "resolve_dispatch_snapshot"
  | "persist_inbound_call"
  | "persist_intake_fields"
  | "persist_message"
  | "resolve_transfer"
  | "extract_fields"
  | "get_availability"
  | "commit_booking"
  | "cancel_booking"
  | "reschedule_booking"
  | "find_appointments"
  | "business_answer"
  | "send_sms"
  | "emit_event"
  | "record_call_telemetry"
  | "resolve_voice_v3_livekit_session"
  | "execute_voice_v3_livekit_tool"
  | "resolve_voice_v3_delegated_runtime_context"
  | "commit_voice_v3_livekit_caller_utterance"
  | "record_voice_v3_transfer_outcome"
  | "append_voice_v3_forensic_events"
  | "flush_voice_v3_forensics";

function logInternalVoice(
  event: string,
  fields: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({
      service: "transovo-web",
      event,
      timestamp: new Date().toISOString(),
      ...fields,
    }),
  );
}

/** GET — connectivity probe (no auth). Voice worker should use POST for actions. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "transovo-web",
    route: "/api/internal/voice-runtime",
    accepts: "POST",
    apiVersion: 1,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const started = Date.now();
  const authHeader = request.headers.get("authorization");
  const authValid = verifyVoiceRuntimeInternalAuth(authHeader);

  let body: { action?: VoiceRuntimeAction; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    logInternalVoice("internal_voice_response", {
      action: "unknown",
      auth_valid: authValid,
      status: 400,
      duration_ms: Date.now() - started,
      error: "invalid_json",
    });
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action ?? "unknown";

  logInternalVoice("internal_voice_request_received", {
    action,
    auth_valid: authValid,
  });

  if (!authValid) {
    logInternalVoice("internal_voice_response", {
      action,
      auth_valid: false,
      status: 401,
      duration_ms: Date.now() - started,
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = body.payload || {};

  try {
    let result: unknown;

    switch (action) {
      case "bootstrap_inbound": {
        const { bootstrapInboundForPython } = await import(
          "@/lib/voice/python-runtime-bridge/bootstrap-inbound"
        );
        result = await bootstrapInboundForPython(payload as never);
        break;
      }

      case "resolve_dispatch_snapshot": {
        const { resolveDispatchSnapshotForPython } = await import(
          "@/lib/voice/python-runtime-bridge/resolve-dispatch-snapshot"
        );
        result = await resolveDispatchSnapshotForPython(payload as never);
        break;
      }

      case "persist_inbound_call": {
        const { persistInboundCallForPython } = await import(
          "@/lib/voice/python-runtime-bridge/persist-inbound-call"
        );
        result = await persistInboundCallForPython(payload as never);
        break;
      }

      case "persist_intake_fields": {
        const { persistIntakeFieldsForPython } = await import(
          "@/lib/voice/python-runtime-bridge/persist-intake-fields"
        );
        result = await persistIntakeFieldsForPython(payload as never);
        break;
      }

      case "persist_message": {
        const { persistMessageForPython } = await import(
          "@/lib/voice/python-runtime-bridge/persist-message"
        );
        result = await persistMessageForPython(payload as never);
        break;
      }

      case "resolve_transfer": {
        const { resolveTransferForPython } = await import(
          "@/lib/voice/python-runtime-bridge/resolve-transfer"
        );
        result = await resolveTransferForPython(payload as never);
        break;
      }

      case "extract_fields": {
        const { extractFieldsForPython } = await import(
          "@/lib/voice/python-runtime-bridge/extract-fields-for-python"
        );
        result = await extractFieldsForPython(payload as never);
        break;
      }

      case "get_availability": {
        const { getAvailabilityForPython } = await import(
          "@/lib/voice/python-runtime-bridge/get-availability-for-python"
        );
        result = await getAvailabilityForPython(payload as never);
        break;
      }

      case "commit_booking": {
        const { commitBookingForPython } = await import(
          "@/lib/voice/python-runtime-bridge/commit-booking-for-python"
        );
        result = await commitBookingForPython(payload as never);
        break;
      }

      case "cancel_booking": {
        const { cancelBookingForPython } = await import(
          "@/lib/voice/python-runtime-bridge/cancel-booking-for-python"
        );
        result = await cancelBookingForPython(payload as never);
        break;
      }

      case "reschedule_booking": {
        const { rescheduleBookingForPython } = await import(
          "@/lib/voice/python-runtime-bridge/reschedule-booking-for-python"
        );
        result = await rescheduleBookingForPython(payload as never);
        break;
      }

      case "find_appointments": {
        const { findAppointmentsForPython } = await import(
          "@/lib/voice/python-runtime-bridge/find-appointments-for-python"
        );
        result = await findAppointmentsForPython(payload as never);
        break;
      }

      case "business_answer": {
        const { businessAnswerForPython } = await import(
          "@/lib/voice/python-runtime-bridge/business-answer-for-python"
        );
        result = await businessAnswerForPython(payload as never);
        break;
      }

      case "send_sms": {
        const { sendSmsForPython } = await import(
          "@/lib/voice/python-runtime-bridge/send-sms-for-python"
        );
        result = await sendSmsForPython({
          workspaceId: String(payload.workspaceId || ""),
          agentId: payload.agentId ? String(payload.agentId) : null,
          callId: payload.callId ? String(payload.callId) : null,
          to: payload.to ? String(payload.to) : null,
          body: String(payload.body || ""),
          phoneNumberId: payload.phoneNumberId ? String(payload.phoneNumberId) : null,
        });
        break;
      }

      case "emit_event": {
        const { emitVoiceRuntimeEvent } = await import(
          "@/lib/voice/python-runtime-bridge/emit-voice-event-for-python"
        );
        result = await emitVoiceRuntimeEvent(payload as never);
        break;
      }

      case "record_call_telemetry": {
        const { recordCallTelemetryForPython } = await import(
          "@/lib/voice/python-runtime-bridge/record-call-telemetry-for-python"
        );
        result = await recordCallTelemetryForPython(payload as never);
        break;
      }

      case "resolve_voice_v3_livekit_session": {
        const { resolveVoiceV3LiveKitSession } = await import(
          "@/lib/voice/python-runtime-bridge/voice-v3-livekit"
        );
        result = await resolveVoiceV3LiveKitSession(payload as never);
        break;
      }

      case "execute_voice_v3_livekit_tool": {
        const { executeVoiceV3ToolForLiveKit } = await import(
          "@/lib/voice/python-runtime-bridge/voice-v3-livekit"
        );
        result = await executeVoiceV3ToolForLiveKit(payload as never);
        break;
      }

      case "resolve_voice_v3_delegated_runtime_context": {
        const { resolveVoiceV3DelegatedRuntimeContextForLiveKitBridge } = await import(
          "@/lib/voice/python-runtime-bridge/voice-v3-livekit"
        );
        result = await resolveVoiceV3DelegatedRuntimeContextForLiveKitBridge(payload as never);
        break;
      }

      case "commit_voice_v3_livekit_caller_utterance": {
        const { commitVoiceV3CallerUtteranceForLiveKit } = await import(
          "@/lib/voice/python-runtime-bridge/voice-v3-livekit"
        );
        result = commitVoiceV3CallerUtteranceForLiveKit(payload as never);
        break;
      }

      case "record_voice_v3_transfer_outcome": {
        const { recordVoiceV3TransferOutcomeForPython } = await import(
          "@/lib/voice/python-runtime-bridge/record-voice-v3-transfer-outcome-for-python"
        );
        result = await recordVoiceV3TransferOutcomeForPython(payload as never);
        break;
      }

      case "append_voice_v3_forensic_events": {
        const { appendVoiceV3ForensicEventsForPython } = await import(
          "@/lib/voice/python-runtime-bridge/voice-v3-forensics-bridge"
        );
        result = await appendVoiceV3ForensicEventsForPython(payload as never);
        break;
      }

      case "flush_voice_v3_forensics": {
        const { flushVoiceV3ForensicsForPython } = await import(
          "@/lib/voice/python-runtime-bridge/voice-v3-forensics-bridge"
        );
        result = await flushVoiceV3ForensicsForPython(payload as never);
        break;
      }

      default:
        logInternalVoice("internal_voice_response", {
          action,
          auth_valid: true,
          status: 400,
          duration_ms: Date.now() - started,
          error: `unknown_action:${action}`,
        });
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    logInternalVoice("internal_voice_response", {
      action,
      auth_valid: true,
      status: 200,
      duration_ms: Date.now() - started,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice-runtime-internal] handler error", err);
    logInternalVoice("internal_voice_response", {
      action,
      auth_valid: true,
      status: 500,
      duration_ms: Date.now() - started,
      error: message,
    });
    return NextResponse.json(
      { ok: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
