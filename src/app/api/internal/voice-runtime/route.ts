import { NextResponse } from "next/server";
import { verifyVoiceRuntimeInternalAuth } from "@/lib/voice/python-runtime-bridge/auth";
import { bootstrapInboundForPython } from "@/lib/voice/python-runtime-bridge/bootstrap-inbound";
import { persistIntakeFieldsForPython } from "@/lib/voice/python-runtime-bridge/persist-intake-fields";
import { persistMessageForPython } from "@/lib/voice/python-runtime-bridge/persist-message";
import { commitBookingForPython } from "@/lib/voice/python-runtime-bridge/commit-booking-for-python";
import { getAvailabilityForPython } from "@/lib/voice/python-runtime-bridge/get-availability-for-python";
import { resolveTransferForPython } from "@/lib/voice/python-runtime-bridge/resolve-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoiceRuntimeAction =
  | "bootstrap_inbound"
  | "persist_intake_fields"
  | "persist_message"
  | "resolve_transfer"
  | "extract_fields"
  | "get_availability"
  | "commit_booking"
  | "business_answer"
  | "emit_event";

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

async function loadHandlers() {
  return import("@/lib/voice/python-runtime-bridge/handlers");
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
      case "bootstrap_inbound":
        result = await bootstrapInboundForPython(payload as never);
        break;

      case "persist_intake_fields":
        result = await persistIntakeFieldsForPython(payload as never);
        break;

      case "persist_message":
        result = await persistMessageForPython(payload as never);
        break;

      case "resolve_transfer":
        result = await resolveTransferForPython(payload as never);
        break;

      case "extract_fields": {
        const { extractFieldsForPython } = await loadHandlers();
        result = await extractFieldsForPython(payload as never);
        break;
      }

      case "get_availability":
        result = await getAvailabilityForPython(payload as never);
        break;

      case "commit_booking":
        result = await commitBookingForPython(payload as never);
        break;

      case "business_answer": {
        const { businessAnswerForPython } = await loadHandlers();
        result = await businessAnswerForPython(payload as never);
        break;
      }

      case "emit_event": {
        const { emitVoiceRuntimeEvent } = await loadHandlers();
        result = await emitVoiceRuntimeEvent(payload as never);
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
