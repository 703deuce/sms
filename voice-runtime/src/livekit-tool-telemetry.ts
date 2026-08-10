import type { FrontDeskUserData } from "./frontdesk/userdata";
import type { OutboundLeadUserData } from "./outbound/userdata";
import type { VoiceRuntimeUserData } from "./metadata";

export type TelemetryUserData =
  | VoiceRuntimeUserData
  | OutboundLeadUserData
  | { workspaceId: string; callId: string };

export function resolveLiveKitToolContext(userData: TelemetryUserData | undefined): {
  workspaceId: string;
  callId: string;
} | null {
  if (!userData) return null;
  if ("cal" in userData) {
    return {
      workspaceId: userData.workspaceId,
      callId: userData.callId,
    };
  }
  if ("callContext" in userData) {
    return {
      workspaceId: userData.callContext.workspaceId,
      callId: userData.callContext.callId,
    };
  }
  if ("job" in userData && userData.job?.kind === "outbound_lead_qualification") {
    return {
      workspaceId: userData.workspaceId,
      callId: userData.callId,
    };
  }
  return null;
}

export async function withLiveKitToolTelemetry<T>(
  userData: TelemetryUserData | undefined,
  toolType: string,
  args: Record<string, unknown> | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const ctx = resolveLiveKitToolContext(userData);
  if (!ctx) return run();
  const { recordLiveKitBuiltinToolExecution } = await import(
    "@/lib/voice/runtime-provider/livekit-call-telemetry"
  );
  return recordLiveKitBuiltinToolExecution({
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
    toolType,
    args,
    run,
  });
}
