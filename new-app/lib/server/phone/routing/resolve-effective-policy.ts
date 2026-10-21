import { usesPhoneCallControlRuntime } from "@/lib/server/telephony/integrated-phone-ingress";
import { phoneCallForwardingRuntimeAllowed } from "@/lib/server/telephony/forwarding-runtime-gate";
import { getPrisma } from "@/lib/server/db";
import { getAnsweringPolicyForNumber } from "./store";
import {
  inboundCallContext,
  resolveForwardActionConfig,
  resolveForwardingDestinationById,
  resolveForwardingDestinationRow,
} from "./resolve-destination";

export type EffectiveAnswering =
  | { kind: "browser" }
  | { kind: "voicemail" }
  | { kind: "forward"; destinationE164: string; press1: boolean; screeningText?: string | null }
  | { kind: "forward_group"; strategy: string; destinations: Array<{ e164: string; press1: boolean; timeout: number }> }
  | { kind: "auto_attendant"; menuId: string }
  | { kind: "greeting_then_forward"; greeting: string; destinationE164: string }
  | { kind: "conversational_ivr"; agentId: string | null };

type ScheduleJson = {
  afterHoursMode?: string;
  afterHoursDestinationE164?: string;
  afterHoursDestinationId?: string;
  afterHoursDestinationRef?: {
    kind?: string;
    e164PhoneNumber?: string;
    phoneNumberId?: string;
  };
  afterHoursMenuId?: string;
};

export async function resolveEffectiveAnswering(input: {
  workspaceId: string;
  phoneNumberId: string | null;
  settingsJson: unknown;
}): Promise<EffectiveAnswering> {
  if (!input.phoneNumberId) return { kind: "browser" };

  if (
    !usesPhoneCallControlRuntime(input.settingsJson) &&
    !phoneCallForwardingRuntimeAllowed(input.settingsJson)
  ) {
    return { kind: "browser" };
  }

  const policy = await getAnsweringPolicyForNumber(input.workspaceId, input.phoneNumberId);
  if (!policy || policy.paused) return { kind: "browser" };

  const callCtx = await inboundCallContext(input.workspaceId, input.phoneNumberId);

  const { getBusinessHours } = await import("@/lib/server/phone/routing");
  const { timezone } = await getBusinessHours(input.workspaceId);
  const { parseHolidayExceptions, holidayActiveToday } = await import("./holiday-schedule");
  const holiday = holidayActiveToday(
    parseHolidayExceptions(policy.holidayExceptionsJson),
    timezone,
  );
  if (holiday) {
    if (holiday.mode === "voicemail") return { kind: "voicemail" };
    if (holiday.mode === "auto_attendant" && holiday.menuId) {
      return { kind: "auto_attendant", menuId: holiday.menuId };
    }
    if (holiday.mode === "forward") {
      const resolved = await resolveHolidayForward(input.workspaceId, holiday, callCtx);
      if (resolved) {
        return {
          kind: "forward",
          destinationE164: resolved.dialE164,
          press1: resolved.press1,
          screeningText: resolved.screeningText,
        };
      }
    }
  }

  const open = await isBusinessOpenNow(input.workspaceId);
  const schedule = policy.scheduleJson as ScheduleJson | null;
  if (!open) {
    if (schedule?.afterHoursMode === "voicemail") return { kind: "voicemail" };
    if (schedule?.afterHoursMode === "auto_attendant" && schedule.afterHoursMenuId) {
      return { kind: "auto_attendant", menuId: schedule.afterHoursMenuId };
    }
    if (schedule?.afterHoursMode === "forward") {
      const afterHours = await resolveScheduleForward(input.workspaceId, schedule, callCtx);
      if (afterHours) {
        return {
          kind: "forward",
          destinationE164: afterHours.dialE164,
          press1: afterHours.press1,
          screeningText: afterHours.screeningText,
        };
      }
    }
  }

  if (policy.answeringMode === "conversational_ivr") {
    const link = await getPrisma().voiceAgentPhoneNumber.findFirst({
      where: {
        workspaceId: input.workspaceId,
        phoneNumberId: input.phoneNumberId,
        inboundEnabled: true,
      },
      select: { agentId: true },
    });
    return { kind: "conversational_ivr", agentId: link?.agentId ?? null };
  }

  if (policy.answeringMode === "auto_attendant" && policy.autoAttendantMenuId) {
    const menu = policy.autoAttendantMenu;
    if (menu?.status === "published") {
      return { kind: "auto_attendant", menuId: menu.id };
    }
  }

  if (policy.answeringMode === "greeting_then_forward" && policy.greetingText) {
    const dest = await resolvePrimaryDestination(policy, callCtx);
    if (dest) {
      return {
        kind: "greeting_then_forward",
        greeting: policy.greetingText,
        destinationE164: dest.dialE164,
      };
    }
  }

  if (policy.answeringMode === "forward") {
    const group = policy.forwardingGroup;
    if (group?.enabled && group.members.length) {
      const destinations: Array<{ e164: string; press1: boolean; timeout: number }> = [];
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
          // skip invalid member
        }
      }
      if (destinations.length) {
        return { kind: "forward_group", strategy: group.strategy, destinations };
      }
    }
    const dest = await resolvePrimaryDestination(policy, callCtx);
    if (dest) {
      return {
        kind: "forward",
        destinationE164: dest.dialE164,
        press1: dest.press1,
        screeningText: dest.screeningText,
      };
    }
  }

  if (policy.answeringMode === "voicemail") return { kind: "voicemail" };

  return { kind: "browser" };
}

async function resolveHolidayForward(
  workspaceId: string,
  holiday: import("./holiday-schedule").HolidayException,
  callCtx: { inboundPhoneNumberId: string | null; inboundE164: string | null },
) {
  if (holiday.destinationId) {
    return resolveForwardingDestinationById(workspaceId, holiday.destinationId, callCtx);
  }
  const ref = holiday.destinationRef;
  if (ref?.kind === "workspace_number" && ref.phoneNumberId) {
    return resolveForwardActionConfig(
      workspaceId,
      {
        destinationRefKind: "workspace_number",
        destinationRefPhoneNumberId: ref.phoneNumberId,
      },
      callCtx,
    );
  }
  if (ref?.kind === "external_phone" && ref.e164PhoneNumber) {
    return resolveForwardActionConfig(
      workspaceId,
      { destinationRefKind: "external_phone", destinationRefE164: ref.e164PhoneNumber },
      callCtx,
    );
  }
  return null;
}

async function resolveScheduleForward(
  workspaceId: string,
  schedule: ScheduleJson,
  callCtx: { inboundPhoneNumberId: string | null; inboundE164: string | null },
) {
  if (schedule.afterHoursDestinationId) {
    return resolveForwardingDestinationById(workspaceId, schedule.afterHoursDestinationId, callCtx);
  }
  if (schedule.afterHoursDestinationRef?.kind) {
    const ref = schedule.afterHoursDestinationRef;
    if (ref.kind === "workspace_number" && ref.phoneNumberId) {
      return resolveForwardActionConfig(
        workspaceId,
        {
          destinationRefKind: "workspace_number",
          destinationRefPhoneNumberId: ref.phoneNumberId,
        },
        callCtx,
      );
    }
    if (ref.kind === "external_phone" && ref.e164PhoneNumber) {
      return resolveForwardActionConfig(
        workspaceId,
        { destinationRefKind: "external_phone", destinationRefE164: ref.e164PhoneNumber },
        callCtx,
      );
    }
  }
  if (schedule.afterHoursDestinationE164) {
    return resolveForwardActionConfig(
      workspaceId,
      { destinationE164: schedule.afterHoursDestinationE164 },
      callCtx,
    );
  }
  return null;
}

async function resolvePrimaryDestination(
  policy: Awaited<ReturnType<typeof getAnsweringPolicyForNumber>>,
  callCtx: { inboundPhoneNumberId: string | null; inboundE164: string | null },
) {
  if (!policy?.primaryDestinationId) return null;
  return resolveForwardingDestinationById(
    policy.workspaceId,
    policy.primaryDestinationId,
    callCtx,
  );
}

// Lazy import avoids circular dependency with business-hours module.
async function isBusinessOpenNow(workspaceId: string) {
  const { isBusinessOpenNow: fn } = await import("@/lib/server/phone/business-hours");
  return fn(workspaceId);
}
