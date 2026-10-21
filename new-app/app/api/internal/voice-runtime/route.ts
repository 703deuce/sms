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
  | "finalize_voice_v3_call"
  | "append_voice_v3_forensic_events"
  | "flush_voice_v3_forensics"
  | "record_voice_v3_transfer_outcome"
  | "execute_phone_foundation_transfer";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "transovo-new-app",
    route: "/api/internal/voice-runtime",
    accepts: "POST",
    apiVersion: 1,
    runtime: "voice_v3_authority_synced",
    executionAuthority: "src/lib/voice-v3",
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
    // Match monolith `src/app/api/internal/voice-runtime/route.ts`: success bodies are the
    // action result object at the top level (Python worker reads fields directly).
    switch (action) {
      case "resolve_voice_v3_livekit_session":
        return NextResponse.json(
          await resolveVoiceV3LiveKitSessionForNewApp(payload as never),
        );
      case "execute_voice_v3_livekit_tool":
        return NextResponse.json(await executeVoiceV3ToolForNewApp(payload as never));
      case "resolve_voice_v3_delegated_runtime_context":
        return NextResponse.json(
          await resolveDelegatedRuntimeContext({
            liveSessionId: String(payload.liveSessionId || ""),
            delegationId: payload.delegationId as string | null | undefined,
          }),
        );
      case "commit_voice_v3_livekit_caller_utterance":
        return NextResponse.json(
          await commitCallerUtterance({
            liveSessionId: String(payload.liveSessionId || ""),
            utterance: String(payload.utterance || ""),
          }),
        );
      case "finalize_voice_v3_call":
        return NextResponse.json(
          await finalizeVoiceV3Call({
            workspaceId: String(payload.workspaceId || ""),
            callId: String(payload.callId || ""),
            transcript: payload.transcript as string | null | undefined,
            summary: payload.summary as string | null | undefined,
            recordingUrl: payload.recordingUrl as string | null | undefined,
            durationSeconds: payload.durationSeconds as number | null | undefined,
            outcome: payload.outcome as string | null | undefined,
            intent: payload.intent as string | null | undefined,
            idempotencyKey: payload.idempotencyKey as string | null | undefined,
          }),
        );
      case "append_voice_v3_forensic_events": {
        const { appendVoiceV3ForensicEventsForPython } = await import(
          "@/lib/server/voice-v3/python-runtime-bridge/voice-v3-forensics-bridge"
        );
        return NextResponse.json(await appendVoiceV3ForensicEventsForPython(payload as never));
      }
      case "flush_voice_v3_forensics": {
        const { flushVoiceV3ForensicsForPython } = await import(
          "@/lib/server/voice-v3/python-runtime-bridge/voice-v3-forensics-bridge"
        );
        return NextResponse.json(await flushVoiceV3ForensicsForPython(payload as never));
      }
      case "record_voice_v3_transfer_outcome": {
        const { recordVoiceV3TransferOutcomeForNewApp } = await import(
          "@/lib/server/voice-v3/transfer/record-transfer-outcome"
        );
        return NextResponse.json(await recordVoiceV3TransferOutcomeForNewApp(payload as never));
      }
      case "execute_phone_foundation_transfer": {
        const { executePhoneFoundationTransferHandoff } = await import(
          "@/lib/server/phone/orchestration/phone-foundation-transfer"
        );
        const workspaceId = String(payload.workspaceId || "");
        const humanCallId = String(payload.humanCallId || "");
        const inboundCallControlId = String(payload.inboundCallControlId || "");
        const result = await executePhoneFoundationTransferHandoff({
          workspaceId,
          humanCallId,
          inboundCallControlId,
          forwardingGroupId: payload.forwardingGroupId
            ? String(payload.forwardingGroupId)
            : null,
          destinationId: payload.destinationId ? String(payload.destinationId) : null,
          destinationE164: payload.destinationE164
            ? String(payload.destinationE164)
            : null,
          press1: payload.press1 === true,
        });
        return NextResponse.json({ ok: true, ...result });
      }
      default:
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
