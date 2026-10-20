import { getPrisma } from "@/lib/server/db";
import { isBusinessOpenNow } from "@/lib/server/phone/business-hours";
import { readTelephonyProvision } from "@/lib/server/telephony/telephony-record";
import { getAnsweringPolicyForNumber } from "./store";

export type EffectiveAnswering =
  | { kind: "browser" }
  | { kind: "voicemail" }
  | { kind: "forward"; destinationE164: string; press1: boolean; screeningText?: string | null }
  | { kind: "forward_group"; strategy: string; destinations: Array<{ e164: string; press1: boolean; timeout: number }> }
  | { kind: "auto_attendant"; menuId: string }
  | { kind: "greeting_then_forward"; greeting: string; destinationE164: string };

export async function resolveEffectiveAnswering(input: {
  workspaceId: string;
  phoneNumberId: string | null;
  settingsJson: unknown;
}): Promise<EffectiveAnswering> {
  const telephony = readTelephonyProvision(input.settingsJson);
  if (telephony.routingMode !== "telnyx_call_control" || telephony.state !== "active") {
    return { kind: "browser" };
  }

  if (!input.phoneNumberId) return { kind: "browser" };

  const policy = await getAnsweringPolicyForNumber(input.workspaceId, input.phoneNumberId);
  if (!policy || policy.paused) return { kind: "browser" };

  const open = await isBusinessOpenNow(input.workspaceId);
  const schedule = policy.scheduleJson as { afterHoursMode?: string } | null;
  if (!open && schedule?.afterHoursMode === "voicemail") {
    return { kind: "voicemail" };
  }

  if (policy.answeringMode === "auto_attendant" && policy.autoAttendantMenuId) {
    const menu = policy.autoAttendantMenu;
    if (menu?.status === "published") {
      return { kind: "auto_attendant", menuId: menu.id };
    }
  }

  if (policy.answeringMode === "greeting_then_forward" && policy.greetingText) {
    const dest = await resolvePrimaryDestination(policy);
    if (dest) {
      return {
        kind: "greeting_then_forward",
        greeting: policy.greetingText,
        destinationE164: dest.e164,
      };
    }
  }

  if (policy.answeringMode === "forward") {
    const group = policy.forwardingGroup;
    if (group?.enabled && group.members.length) {
      const destinations = group.members
        .filter((m) => m.enabled && m.destination.enabled)
        .map((m) => ({
          e164: m.destination.phoneE164,
          press1: m.destination.press1Required || m.destination.screeningEnabled,
          timeout: m.destination.ringTimeoutSec,
        }));
      if (destinations.length) {
        return { kind: "forward_group", strategy: group.strategy, destinations };
      }
    }
    const dest = await resolvePrimaryDestination(policy);
    if (dest) {
      return {
        kind: "forward",
        destinationE164: dest.e164,
        press1: dest.press1,
        screeningText: dest.screeningText,
      };
    }
  }

  if (policy.answeringMode === "voicemail") return { kind: "voicemail" };

  return { kind: "browser" };
}

async function resolvePrimaryDestination(
  policy: Awaited<ReturnType<typeof getAnsweringPolicyForNumber>>,
) {
  if (!policy?.primaryDestinationId) return null;
  const prisma = getPrisma();
  const dest = await prisma.forwardingDestination.findFirst({
    where: { id: policy.primaryDestinationId, workspaceId: policy.workspaceId, enabled: true },
  });
  if (!dest) return null;
  return {
    e164: dest.phoneE164,
    press1: dest.press1Required || dest.screeningEnabled,
    screeningText: dest.privateAnnouncement,
  };
}
