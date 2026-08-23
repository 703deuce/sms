import "server-only";

import { resolvePlatformOutboundTrunkId } from "@/lib/telephony/provisioning/livekit/outbound-trunk";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function resolveMctbDirectDialTransferForPython(input: {
  workspaceId: string;
  destinationE164: string;
  callerNumberE164?: string | null;
}): Promise<{
  ok: boolean;
  destinationE164?: string;
  sipOutboundTrunkId?: string | null;
  sipCallerIdE164?: string | null;
  error?: string;
}> {
  const workspaceId = input.workspaceId?.trim();
  const destination = normalizeE164(input.destinationE164?.trim() || "");
  if (!workspaceId || !destination) {
    return { ok: false, error: "workspaceId and destinationE164 required" };
  }

  const callerIdE164 = input.callerNumberE164?.trim() || null;
  const sipOutboundTrunkId = await resolvePlatformOutboundTrunkId({ callerIdE164 });

  return {
    ok: true,
    destinationE164: destination,
    sipOutboundTrunkId,
    sipCallerIdE164: callerIdE164,
  };
}
