import { NextResponse } from "next/server";
import { verifyVoiceRuntimeInternalAuth } from "@/lib/voice/python-runtime-bridge/auth";
import {
  checkMctbLegacyIngressBlocked,
  isMctbLegacyVoiceRuntimeAction,
  logMctbLegacyIngressBlocked,
} from "@/lib/mctb/ingress-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoiceRuntimeAction =
  | "check_mctb_sip_ingress"
  | "bootstrap_inbound"
  | "resolve_dispatch_snapshot"
  | "capture_mctb_sip_inbound"
  | "resolve_mctb_sip_session"
  | "resolve_mctb_direct_dial_prompt"
  | "resolve_mctb_direct_dial_transfer"
  | "record_mctb_sip_press_1_consent"
  | "start_mctb_sip_voicemail"
  | "complete_mctb_sip_voicemail"
  | "persist_mctb_voicemail_lifecycle"
  | "mctb_sip_e2e_trace"
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
  | "record_call_telemetry";

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

  if (isMctbLegacyVoiceRuntimeAction(action)) {
    const blocked = checkMctbLegacyIngressBlocked("sip_livekit");
    if (blocked) {
      logMctbLegacyIngressBlocked("sip_livekit", { action });
      logInternalVoice("internal_voice_response", {
        action,
        auth_valid: true,
        status: 410,
        duration_ms: Date.now() - started,
        error: blocked.reason,
      });
      return NextResponse.json(blocked, { status: 410 });
    }
  }

  try {
    let result: unknown;

    switch (action) {
      case "check_mctb_sip_ingress": {
        const { isMctbSipIngressTarget } = await import("@/lib/mctb/sip-ingress/resolver");
        const toE164 = String(payload.toE164 || "").trim();
        result = { route: await isMctbSipIngressTarget(toE164), toE164 };
        break;
      }

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

      case "capture_mctb_sip_inbound": {
        const { captureMctbSipInboundForPython } = await import(
          "@/lib/mctb/event-only/sip-capture"
        );
        result = await captureMctbSipInboundForPython(payload as never);
        break;
      }

      case "resolve_mctb_sip_session": {
        const { resolveMctbSipSessionForPython } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-sip-session"
        );
        result = await resolveMctbSipSessionForPython(payload as never);
        break;
      }

      case "resolve_mctb_direct_dial_prompt": {
        const { loadMissedCallTextConfig } = await import(
          "@/lib/agents/missed-call-text-back/config"
        );
        const { buildDirectDialForwardPromptText, resolveMctbDirectDialForwardE164 } =
          await import("@/lib/mctb/direct-dial-prompt");
        const workspaceId = String(payload.workspaceId || "").trim();
        if (!workspaceId) {
          result = { ok: false, error: "workspaceId required" };
          break;
        }
        const config = await loadMissedCallTextConfig(workspaceId);
        result = {
          ok: true,
          directDialForwardE164: resolveMctbDirectDialForwardE164(config),
          promptText: buildDirectDialForwardPromptText(config),
        };
        break;
      }

      case "resolve_mctb_direct_dial_transfer": {
        const { resolveMctbDirectDialTransferForPython } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-direct-dial-transfer"
        );
        result = await resolveMctbDirectDialTransferForPython({
          workspaceId: String(payload.workspaceId || ""),
          destinationE164: String(payload.destinationE164 || ""),
          callerNumberE164:
            typeof payload.callerNumberE164 === "string" ? payload.callerNumberE164 : null,
        });
        break;
      }

      case "record_mctb_sip_press_1_consent": {
        const { recordMctbSipPress1ConsentForPython } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-sip-session"
        );
        result = await recordMctbSipPress1ConsentForPython(payload as never);
        break;
      }

      case "start_mctb_sip_voicemail": {
        const { startMctbSipVoicemailForPython } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-record"
        );
        result = await startMctbSipVoicemailForPython(payload as never);
        break;
      }

      case "complete_mctb_sip_voicemail": {
        const { completeMctbSipVoicemailForPython } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-record"
        );
        result = await completeMctbSipVoicemailForPython(payload as never);
        break;
      }

      case "persist_mctb_voicemail_lifecycle": {
        const { appendMctbVoicemailLifecycleEvent } = await import(
          "@/lib/voice/python-runtime-bridge/mctb-sip-voicemail-lifecycle"
        );
        result = await appendMctbVoicemailLifecycleEvent(payload as never);
        break;
      }

      case "mctb_sip_e2e_trace": {
        const { logMctbSipE2eMirror } = await import("@/lib/mctb/sip-diagnostic/e2e-trace");
        const tracePayload = (payload.payload || payload) as Record<string, unknown>;
        logMctbSipE2eMirror(tracePayload);
        result = { ok: true, mirrored: true };
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
