/**
 * Bounded conversation state for appointment AI — not full thread dumps.
 */

import type { UnderstandingResult } from "./schema";

export type AppointmentConversationState = {
  activeIntent?: string;
  appointmentId?: string;
  appointmentTypeId?: string;
  serviceName?: string;
  staffPreference?: string;
  locationPreference?: string;
  lastOfferedSlots?: Array<{ startsAt: string; endsAt: string }>;
  unresolvedClarification?: string;
  updatedAt: string;
};

const STATE_KEY = "appointmentAi";

export function parseConversationState(
  customFields: unknown,
): AppointmentConversationState | null {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return null;
  }
  const root = customFields as Record<string, unknown>;
  const raw = root[STATE_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const slots = Array.isArray(s.lastOfferedSlots)
    ? s.lastOfferedSlots
        .filter((x): x is { startsAt: string; endsAt: string } =>
          Boolean(
            x &&
              typeof x === "object" &&
              typeof (x as { startsAt?: unknown }).startsAt === "string" &&
              typeof (x as { endsAt?: unknown }).endsAt === "string",
          ),
        )
        .slice(0, 8)
    : undefined;

  return {
    activeIntent: typeof s.activeIntent === "string" ? s.activeIntent : undefined,
    appointmentId: typeof s.appointmentId === "string" ? s.appointmentId : undefined,
    appointmentTypeId: typeof s.appointmentTypeId === "string" ? s.appointmentTypeId : undefined,
    serviceName: typeof s.serviceName === "string" ? s.serviceName : undefined,
    staffPreference: typeof s.staffPreference === "string" ? s.staffPreference : undefined,
    locationPreference: typeof s.locationPreference === "string" ? s.locationPreference : undefined,
    lastOfferedSlots: slots,
    unresolvedClarification:
      typeof s.unresolvedClarification === "string" ? s.unresolvedClarification : undefined,
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : new Date().toISOString(),
  };
}

export function mergeConversationState(
  existing: unknown,
  patch: Partial<AppointmentConversationState>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const prev = parseConversationState(base) || { updatedAt: new Date().toISOString() };
  return {
    ...base,
    [STATE_KEY]: {
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function applyStateHintsToUnderstanding(
  understanding: UnderstandingResult,
  state: AppointmentConversationState | null,
): UnderstandingResult {
  if (!state) return understanding;
  const next = { ...understanding };

  if (!next.appointmentReference.appointmentId && state.appointmentId) {
    next.appointmentReference = {
      ...next.appointmentReference,
      appointmentId: state.appointmentId,
    };
  }
  if (!next.servicePreference.appointmentTypeId && state.appointmentTypeId) {
    next.servicePreference = {
      ...next.servicePreference,
      appointmentTypeId: state.appointmentTypeId,
    };
  }
  if (!next.servicePreference.nameMentioned && state.serviceName) {
    next.servicePreference = {
      ...next.servicePreference,
      nameMentioned: state.serviceName,
    };
  }
  if (!next.staffPreference.nameMentioned && state.staffPreference) {
    next.staffPreference = {
      ...next.staffPreference,
      nameMentioned: state.staffPreference,
    };
  }
  if (!next.locationPreference.nameMentioned && state.locationPreference) {
    next.locationPreference = {
      ...next.locationPreference,
      nameMentioned: state.locationPreference,
    };
  }

  return next;
}

export function stateFromUnderstanding(
  understanding: UnderstandingResult,
  slots?: Array<{ startsAt: string; endsAt: string }>,
): Partial<AppointmentConversationState> {
  return {
    activeIntent: understanding.intent,
    appointmentId: understanding.appointmentReference.appointmentId || undefined,
    appointmentTypeId: understanding.servicePreference.appointmentTypeId || undefined,
    serviceName: understanding.servicePreference.nameMentioned || undefined,
    staffPreference: understanding.staffPreference.nameMentioned || undefined,
    locationPreference: understanding.locationPreference.nameMentioned || undefined,
    lastOfferedSlots: slots,
    unresolvedClarification: understanding.requiresClarification
      ? understanding.clarificationReason || understanding.intent
      : undefined,
  };
}

export function resolveSlotFromConversation(
  text: string,
  state: AppointmentConversationState | null,
): { startsAt: string; endsAt: string } | null {
  if (!state?.lastOfferedSlots?.length) return null;
  const lower = text.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const ampm = timeMatch[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (!ampm && hour >= 1 && hour <= 7) hour += 12;

  for (const slot of state.lastOfferedSlots) {
    const d = new Date(slot.startsAt);
    if (d.getUTCHours() === hour && d.getUTCMinutes() === minute) return slot;
    const localHour = d.getHours();
    const localMin = d.getMinutes();
    if (localHour === hour && localMin === minute) return slot;
  }
  return state.lastOfferedSlots[state.lastOfferedSlots.length - 1] || null;
}
