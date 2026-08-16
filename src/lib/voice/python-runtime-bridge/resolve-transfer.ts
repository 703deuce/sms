import { getPrisma } from "@/lib/db";

type TransferPolicy = {
  destinationE164?: string;
  transferNumber?: string;
  emergencyDestinationE164?: string;
  warmTransfer?: boolean;
  enabled?: boolean;
  takeMessageOnFailure?: boolean;
};

function isEmergencyTransfer(reason?: string): boolean {
  const text = (reason || "").trim().toLowerCase();
  return text.includes("emergency");
}

/** Lightweight transfer resolution for Python WarmTransferTask (no voice-runtime imports). */
export async function resolveTransferForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  reason?: string;
  transferPolicy?: TransferPolicy | null;
}): Promise<
  | {
      ok: true;
      allowed: boolean;
      destinationE164?: string;
      warmTransfer: boolean;
      takeMessageOnFailure: boolean;
    }
  | { ok: false; error: string; code?: string }
> {
  const policy = input.transferPolicy || {};
  const emergency = policy.emergencyDestinationE164?.trim();
  const reason = input.reason?.trim();

  let destination =
    emergency && isEmergencyTransfer(reason)
      ? emergency
      : policy.destinationE164?.trim() || policy.transferNumber?.trim();

  if (!destination) {
    const fallback = process.env.VOICE_TRANSFER_FALLBACK_E164?.trim();
    if (fallback) destination = fallback;
  }

  if (!destination) {
    const prisma = getPrisma();
    const dest = await prisma.voiceTransferDestination.findFirst({
      where: { workspaceId: input.workspaceId, enabled: true },
      orderBy: { updatedAt: "desc" },
      select: { destination: true },
    });
    destination = dest?.destination?.trim() || undefined;
  }

  if (!destination) {
    return {
      ok: true,
      allowed: false,
      warmTransfer: policy.warmTransfer !== false,
      takeMessageOnFailure: policy.takeMessageOnFailure !== false,
    };
  }

  return {
    ok: true,
    allowed: true,
    destinationE164: destination,
    warmTransfer: policy.warmTransfer !== false,
    takeMessageOnFailure: policy.takeMessageOnFailure !== false,
  };
}
