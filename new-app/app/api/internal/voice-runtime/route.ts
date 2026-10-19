import { NextResponse } from "next/server";
import { verifyVoiceRuntimeInternalAuth } from "@/lib/server/receptionist/runtime/auth";
import { resolveVoiceV3LiveKitSessionForNewApp } from "@/lib/server/receptionist/runtime/session";
import { executeVoiceV3ToolForNewApp } from "@/lib/server/receptionist/runtime/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoiceRuntimeAction =
  | "resolve_voice_v3_livekit_session"
  | "execute_voice_v3_livekit_tool"
  | "resolve_voice_v3_delegated_runtime_context"
  | "commit_voice_v3_livekit_caller_utterance";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "transovo-new-app",
    route: "/api/internal/voice-runtime",
    accepts: "POST",
    apiVersion: 1,
  });
}

export async function POST(request: Request) {
  const authValid = verifyVoiceRuntimeInternalAuth(request.headers.get("authorization"));
  if (!authValid) {
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
      case "resolve_voice_v3_livekit_session":
        return NextResponse.json({
          ok: true,
          result: await resolveVoiceV3LiveKitSessionForNewApp(payload as never),
        });
      case "execute_voice_v3_livekit_tool":
        return NextResponse.json({
          ok: true,
          result: await executeVoiceV3ToolForNewApp(payload as never),
        });
      case "resolve_voice_v3_delegated_runtime_context":
        return NextResponse.json({ ok: true, result: { liveContextEvents: [] } });
      case "commit_voice_v3_livekit_caller_utterance":
        return NextResponse.json({
          ok: true,
          result: { committed: true, sequence: 1, turnId: "turn_1" },
        });
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
