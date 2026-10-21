import "server-only";

import { getPrisma } from "@/lib/server/db";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import type { EffectiveAnswering } from "@/lib/server/phone/routing/resolve-effective-policy";
import { startForwardingFlow } from "@/lib/server/phone/routing/forwarding-service";
import { recordAiParticipationEnd } from "@/lib/server/phone/orchestration/usage-correlation";

export async function executePhoneFoundationTransferHandoff(input: {
  workspaceId: string;
  humanCallId: string;
  inboundCallControlId: string;
  forwardingGroupId?: string | null;
  destinationId?: string | null;
  destinationE164?: string | null;
  press1?: boolean;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call?.phoneNumberId) throw new Error("Call or business line missing");

  await recordAiParticipationEnd(input.workspaceId, input.humanCallId);

  let effective: EffectiveAnswering;

  if (input.forwardingGroupId) {
    const policy = await prisma.phoneNumberAnsweringPolicy.findUnique({
      where: { phoneNumberId: call.phoneNumberId },
      include: {
        forwardingGroup: {
          include: {
            members: {
              where: { enabled: true },
              include: { destination: true },
              orderBy: { priority: "asc" },
            },
          },
        },
      },
    });
    const group = policy?.forwardingGroup;
    if (!group?.enabled || group.id !== input.forwardingGroupId) {
      throw new Error("Forwarding group is not available on this line");
    }
    const destinations: Array<{ e164: string; press1: boolean; timeout: number }> = [];
    const { resolveForwardingDestinationRow, inboundCallContext } = await import(
      "@/lib/server/phone/routing/resolve-destination"
    );
    const callCtx = await inboundCallContext(input.workspaceId, call.phoneNumberId);
    for (const m of group.members) {
      if (!m.enabled || !m.destination.enabled) continue;
      try {
        const resolved = await resolveForwardingDestinationRow(m.destination, callCtx);
        destinations.push({
          e164: resolved.dialE164,
          press1: resolved.press1,
          timeout: resolved.ringTimeoutSec,
        });
      } catch {
        // skip invalid
      }
    }
    if (!destinations.length) throw new Error("Forwarding group has no dialable members");
    effective = {
      kind: "forward_group",
      strategy: group.strategy,
      destinations,
    };
  } else if (input.destinationE164) {
    effective = {
      kind: "forward",
      destinationE164: input.destinationE164,
      press1: Boolean(input.press1),
    };
  } else if (input.destinationId) {
    const { resolveForwardingDestinationById, inboundCallContext } = await import(
      "@/lib/server/phone/routing/resolve-destination"
    );
    const callCtx = await inboundCallContext(input.workspaceId, call.phoneNumberId);
    const resolved = await resolveForwardingDestinationById(
      input.workspaceId,
      input.destinationId,
      callCtx,
    );
    if (!resolved) throw new Error("Forwarding destination not found");
    effective = {
      kind: "forward",
      destinationE164: resolved.dialE164,
      press1: resolved.press1,
      screeningText: resolved.screeningText,
    };
  } else {
    throw new Error("Transfer target required");
  }

  phoneServerLog("phone-orchestration", "ai_to_phone_handoff", {
    humanCallId: input.humanCallId,
    effective: effective.kind,
  });

  await startForwardingFlow({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    phoneNumberId: call.phoneNumberId,
    inboundControlId: input.inboundCallControlId,
    businessLineE164: call.to,
    callerE164: call.from,
    effective,
  });

  const meta = (call.metadata as Record<string, unknown>) || {};
  await prisma.humanCall.update({
    where: { id: call.humanCallId },
    data: {
      metadata: {
        ...meta,
        orchestration: {
          ...((meta.orchestration as Record<string, unknown>) || {}),
          stage: "phone_forwarding_after_ai",
        },
      },
    },
  });

  return { ok: true, effective: effective.kind };
}
