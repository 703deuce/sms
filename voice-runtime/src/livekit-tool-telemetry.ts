import type { FrontDeskUserData } from "./frontdesk/userdata";
import type { VoiceRuntimeUserData } from "./metadata";

export function resolveLiveKitToolContext(userData: VoiceRuntimeUserData | undefined): {
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
  return null;
}

export async function withLiveKitToolTelemetry<T>(
  userData: FrontDeskUserData | undefined,
  toolType: string,
  args: Record<string, unknown> | undefined,
  run: () => Promise<T>,
): Promise<T> {
  if (!userData) return run();
  const { recordLiveKitBuiltinToolExecution } = await import(
    "@/lib/voice/runtime-provider/livekit-call-telemetry"
  );
  return recordLiveKitBuiltinToolExecution({
    workspaceId: userData.workspaceId,
    callId: userData.callId,
    toolType,
    args,
    run,
  });
}
