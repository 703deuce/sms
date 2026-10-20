import { getPrisma } from "@/lib/server/db";
import { normalizeE164 } from "@/lib/server/phone/normalize";

const MAX_DEPTH = 8;

type ProposedTarget =
  | { kind: "external_phone"; e164: string }
  | { kind: "workspace_number"; phoneNumberId: string };

/**
 * Reject indirect forwarding loops (e.g. A forwards to B, B forwards back to A).
 * Only walks telnyx-style forward / greeting_then_forward edges via saved destinations.
 */
export async function assertNoIndirectForwardingLoop(
  workspaceId: string,
  inboundPhoneNumberId: string | undefined,
  proposed: ProposedTarget,
) {
  if (!inboundPhoneNumberId) return;

  let startPhoneId: string | null = null;
  if (proposed.kind === "workspace_number") {
    startPhoneId = proposed.phoneNumberId;
  } else {
    const e164 = normalizeE164(proposed.e164);
    const hosted = await getPrisma().phoneNumber.findFirst({
      where: { workspaceId, e164, status: "Active" },
      select: { id: true },
    });
    startPhoneId = hosted?.id ?? null;
  }
  if (!startPhoneId || startPhoneId === inboundPhoneNumberId) {
    if (startPhoneId === inboundPhoneNumberId) {
      throw new Error("Forwarding would loop back to the same business number");
    }
    return;
  }

  const visited = new Set<string>();
  const queue: Array<{ phoneId: string; depth: number }> = [{ phoneId: startPhoneId, depth: 0 }];

  while (queue.length) {
    const { phoneId, depth } = queue.shift()!;
    if (depth > MAX_DEPTH) continue;
    if (phoneId === inboundPhoneNumberId) {
      throw new Error(
        "This forwarding path would loop back to the incoming business number. Choose a different destination.",
      );
    }
    if (visited.has(phoneId)) continue;
    visited.add(phoneId);

    const policy = await getPrisma().phoneNumberAnsweringPolicy.findUnique({
      where: { phoneNumberId: phoneId },
      include: {
        forwardingGroup: {
          include: {
            members: { include: { destination: true } },
          },
        },
      },
    });
    if (!policy || policy.paused) continue;

    const modes = new Set(["forward", "greeting_then_forward"]);
    if (!modes.has(policy.answeringMode)) continue;

    const destIds: string[] = [];
    if (policy.primaryDestinationId) destIds.push(policy.primaryDestinationId);
    if (policy.forwardingGroup?.members) {
      for (const m of policy.forwardingGroup.members) {
        if (m.enabled && m.destination.enabled) destIds.push(m.destination.id);
      }
    }

    if (!destIds.length) continue;

    const destinations = await getPrisma().forwardingDestination.findMany({
      where: { workspaceId, id: { in: destIds }, enabled: true },
    });

    for (const d of destinations) {
      if (d.workspacePhoneNumberId) {
        queue.push({ phoneId: d.workspacePhoneNumberId, depth: depth + 1 });
      } else if (d.phoneE164) {
        const e164 = normalizeE164(d.phoneE164);
        const hosted = await getPrisma().phoneNumber.findFirst({
          where: { workspaceId, e164, status: "Active" },
          select: { id: true },
        });
        if (hosted) queue.push({ phoneId: hosted.id, depth: depth + 1 });
      }
    }
  }
}
