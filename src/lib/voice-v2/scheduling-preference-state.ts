import type { VoiceV2CallContext } from "./intake/types";
import { normalizeRequestedDate, type VoiceV2BookingWorkflow } from "./booking-workflow";
import { resolveSpokenDateYmd } from "@/lib/voice/calendar/resolve-datetime";

export type VoiceV2SchedulingDaypart = "morning" | "afternoon" | "evening" | "noon";

export type VoiceV2SchedulingPreference = {
  requestedDate?: string;
  requestedTime?: string;
  requestedDaypart?: VoiceV2SchedulingDaypart;
  rawDatePhrase?: string;
  rawTimePhrase?: string;
  updatedAt?: string;
  evidence?: string;
};

export function schedulingPreferenceFromContext(
  ctx: VoiceV2CallContext,
): VoiceV2SchedulingPreference | undefined {
  return ctx.schedulingPreference;
}

export function effectiveRequestedDate(
  ctx: VoiceV2CallContext,
  workflow?: VoiceV2BookingWorkflow,
): string | null {
  const w = workflow ?? ctx.bookingWorkflow;
  const fromWorkflow = normalizeRequestedDate(w?.requestedDate);
  if (fromWorkflow) return fromWorkflow;
  return normalizeRequestedDate(ctx.schedulingPreference?.requestedDate);
}

export function normalizeDaypart(raw: unknown): VoiceV2SchedulingDaypart | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "morning" || s === "afternoon" || s === "evening" || s === "noon") return s;
  return undefined;
}

export function extractSchedulingFromCallerSpeech(input: {
  utterance: string;
  timezone: string;
  now?: Date;
  entities?: {
    requested_day?: string | null;
    requested_daypart?: string | null;
    requested_time?: string | null;
  };
}): Partial<VoiceV2SchedulingPreference> | null {
  const utterance = input.utterance.trim();
  if (!utterance) return null;

  const resolved = resolveSpokenDateYmd({
    spoken: utterance,
    timezone: input.timezone,
    now: input.now,
  });

  const daypart =
    normalizeDaypart(input.entities?.requested_daypart) ??
    (/\bmorning\b/i.test(utterance) ? "morning" : undefined) ??
    (/\bafternoon\b/i.test(utterance) ? "afternoon" : undefined) ??
    (/\bevening\b/i.test(utterance) ? "evening" : undefined);

  const hasSignal =
    Boolean(resolved?.ymd) ||
    Boolean(daypart) ||
    Boolean(input.entities?.requested_time) ||
    Boolean(input.entities?.requested_day);

  if (!hasSignal) return null;

  const out: Partial<VoiceV2SchedulingPreference> = {
    updatedAt: new Date().toISOString(),
    evidence: utterance.slice(0, 240),
  };

  if (resolved?.ymd) {
    out.requestedDate = resolved.ymd;
    out.rawDatePhrase =
      input.entities?.requested_day?.trim() || utterance.slice(0, 120);
  } else if (input.entities?.requested_day) {
    out.rawDatePhrase = input.entities.requested_day;
  }

  if (daypart) out.requestedDaypart = daypart;
  if (input.entities?.requested_time) {
    out.requestedTime = input.entities.requested_time;
    out.rawTimePhrase = input.entities.requested_time;
  }

  return out;
}

/** Merge scheduling patch; latest explicit caller evidence wins. */
export function mergeSchedulingPreferenceRecord(
  prior: VoiceV2SchedulingPreference | undefined,
  patch: Partial<VoiceV2SchedulingPreference>,
): VoiceV2SchedulingPreference {
  const next: VoiceV2SchedulingPreference = { ...(prior ?? {}) };
  if (patch.requestedDate) next.requestedDate = patch.requestedDate;
  if (patch.requestedDaypart) next.requestedDaypart = patch.requestedDaypart;
  if (patch.requestedTime) next.requestedTime = patch.requestedTime;
  if (patch.rawDatePhrase) next.rawDatePhrase = patch.rawDatePhrase;
  if (patch.rawTimePhrase) next.rawTimePhrase = patch.rawTimePhrase;
  if (patch.evidence) next.evidence = patch.evidence;
  if (patch.updatedAt) next.updatedAt = patch.updatedAt;
  return next;
}

export function syncWorkflowRequestedDateFromScheduling(
  workflow: VoiceV2BookingWorkflow,
  pref?: VoiceV2SchedulingPreference,
): VoiceV2BookingWorkflow {
  const date = normalizeRequestedDate(pref?.requestedDate);
  if (!date) return workflow;
  if (workflow.requestedDate === date) return workflow;
  return { ...workflow, requestedDate: date, bookingIntentActive: true };
}
