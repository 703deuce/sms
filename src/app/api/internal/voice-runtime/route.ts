import { NextResponse } from "next/server";
import { verifyVoiceRuntimeInternalAuth } from "@/lib/voice/python-runtime-bridge/auth";
import { bootstrapInboundForPython } from "@/lib/voice/python-runtime-bridge/bootstrap-inbound";

export const runtime = "nodejs";

type VoiceRuntimeAction =
  | "bootstrap_inbound"
  | "persist_intake_fields"
  | "extract_fields"
  | "get_availability"
  | "commit_booking"
  | "business_answer"
  | "emit_event";

async function loadHandlers() {
  return import("@/lib/voice/python-runtime-bridge/handlers");
}

export async function POST(request: Request) {
  if (!verifyVoiceRuntimeInternalAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: VoiceRuntimeAction; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  const payload = body.payload || {};

  try {
    switch (action) {
      case "bootstrap_inbound":
        return NextResponse.json(await bootstrapInboundForPython(payload as never));

      case "persist_intake_fields": {
        const { persistIntakeFieldsForPython } = await loadHandlers();
        return NextResponse.json(await persistIntakeFieldsForPython(payload as never));
      }

      case "extract_fields": {
        const { extractFieldsForPython } = await loadHandlers();
        return NextResponse.json(await extractFieldsForPython(payload as never));
      }

      case "get_availability": {
        const { getAvailabilityForPython } = await loadHandlers();
        return NextResponse.json(await getAvailabilityForPython(payload as never));
      }

      case "commit_booking": {
        const { commitBookingForPython } = await loadHandlers();
        return NextResponse.json(await commitBookingForPython(payload as never));
      }

      case "business_answer": {
        const { businessAnswerForPython } = await loadHandlers();
        return NextResponse.json(await businessAnswerForPython(payload as never));
      }

      case "emit_event": {
        const { emitVoiceRuntimeEvent } = await loadHandlers();
        return NextResponse.json(await emitVoiceRuntimeEvent(payload as never));
      }

      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    console.error("[voice-runtime-internal] handler error", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
