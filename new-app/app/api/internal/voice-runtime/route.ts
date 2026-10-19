import { NextResponse } from "next/server";
import { verifyVoiceRuntimeInternalAuth } from "@/lib/server/receptionist/runtime/auth";
import { resolveVoiceV3LiveKitSessionForNewApp } from "@/lib/server/receptionist/runtime/session";
import { executeVoiceV3ToolForNewApp } from "@/lib/server/receptionist/runtime/tools";
import { commitCallerUtterance, resolveDelegatedRuntimeContext } from "@/lib/server/voice-v3/delegation";
import { finalizeVoiceV3Call } from "@/lib/server/voice-v3/post-call/finalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VoiceRuntimeAction =
  | "resolve_voice_v3_livekit_session"
  | "execute_voice_v3_livekit_tool"
  | "resolve_voice_v3_delegated_runtime_context"
  | "commit_voice_v3_livekit_caller_utterance"
  | "finalize_voice_v3_call";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "transovo-new-app",
    route: "/api/internal/voice-runtime",
    accepts: "POST",
    apiVersion: 1,
    runtime: "native_voice_v3",
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
        return NextResponse.json({
          ok: true,
          result: await resolveDelegatedRuntimeContext({
            liveSessionId: String(payload.liveSessionId || ""),
            delegationId: payload.delegationId as string | null | undefined,
          }),
        });
      case "commit_voice_v3_livekit_caller_utterance":
        return NextResponse.json({
          ok: true,
          result: await commitCallerUtterance({
            liveSessionId: String(payload.liveSessionId || ""),
            utterance: String(payload.utterance || ""),
          }),
        });
      case "finalize_voice_v3_call":
        return NextResponse.json({
          ok: true,
          result: await finalizeVoiceV3Call({
            workspaceId: String(payload.workspaceId || ""),
            callId: String(payload.callId || ""),
            transcript: payload.transcript as string | null | undefined,
            summary: payload.summary as string | null | undefined,
            recordingUrl: payload.recordingUrl as string | null | undefined,
            durationSeconds: payload.durationSeconds as number | null | undefined,
            outcome: payload.outcome as string | null | undefined,
            intent: payload.intent as string | null | undefined,
          }),
        });
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
