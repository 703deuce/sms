import type { SaveIntakeResult } from "./save-intake-fields";
import { VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS } from "../caller-experience-law";
import { listKnownCallerFieldValues } from "./caller-field-state";
import type { IntakeFieldKey } from "./types";
import type { VoiceV2NextStage } from "../booking-workflow";
import { getVoiceV2CallContext } from "./session-store";

function mergeWorkflowFields(
  base: Record<string, unknown>,
  workflow?: Record<string, unknown>,
): Record<string, unknown> {
  if (!workflow) return base;
  return { ...base, ...workflow };
}

function speakForWorkflowStage(
  stage: VoiceV2NextStage | undefined,
  bookingContinue: boolean,
  missingBeforeBooking: string[],
): string | null {
  if (stage === "COLLECT_REQUIRED_INTAKE" && missingBeforeBooking.length > 0) {
    return "Got it. Ask only for the missing caller details — do not ask for the day again.";
  }
  if (!bookingContinue) return null;
  if (stage === "COLLECT_SCHEDULING_PREFERENCE") {
    return "Saved. Ask what day works for the appointment — do not close with callback or follow-up.";
  }
  if (stage === "FIND_AVAILABILITY") {
    return "Thanks. Acknowledge the known day briefly, then call voice_v2_find_availability — do not ask for the day again.";
  }
  return "Saved. Continue live booking — do not close with callback or follow-up.";
}

function knownFieldsPayload(sessionKey?: string): Record<string, string> {
  if (!sessionKey) return {};
  const ctx = getVoiceV2CallContext(sessionKey);
  if (!ctx) return {};
  return listKnownCallerFieldValues(ctx) as Record<string, string>;
}

export function saveIntakePublicFields(
  result: SaveIntakeResult,
  sessionKey?: string,
): Record<string, unknown> {
  const readiness =
    result.status === "INTAKE_SAVED" || result.status === "FIELD_NOT_ENABLED"
      ? result.readiness
      : undefined;
  const missingBeforeBooking = readiness?.missingBeforeBooking ?? [];
  const knownCallerFields = knownFieldsPayload(sessionKey);

  if (result.status === "INTAKE_SAVED") {
    const ignored = result.ignored_fields || [];
    const invalid = result.invalid_fields || [];
    let speak = result.saved.length
      ? ignored.length
        ? "Saved. Some details are not collected on this line; continue scheduling."
        : "Saved."
      : "No changes.";
    if (invalid.length) {
      if (invalid.includes("email")) {
        speak =
          missingBeforeBooking.length === 0
            ? "Got the other details. I still need your email — say it like name at domain dot com, or spell the part before the at sign."
            : "Saved what I could. For email, say it like name at gmail dot com so I can save it.";
      } else {
        speak = "Saved what I could. Could you repeat the part I didn't catch?";
      }
    }
    const wf = result.workflow;
    const stage = wf?.voice_v2_next_stage as VoiceV2NextStage | undefined;
    const bookingContinue = wf?.booking_continue_required === true;
    const wfSpeak = speakForWorkflowStage(stage, bookingContinue, missingBeforeBooking);
    if (wfSpeak && !invalid.length) speak = wfSpeak;

    return mergeWorkflowFields(
      {
        ok: true,
        status: "INTAKE_SAVED",
        voice_v2_status: "INTAKE_SAVED",
        saved_fields: result.saved,
        saved: result.saved,
        ignored_fields: ignored,
        invalid_fields: invalid.length ? invalid : undefined,
        missingBeforeBooking,
        missing_for_booking_only: missingBeforeBooking,
        known_caller_fields: knownCallerFields,
        readiness: result.readiness,
        continue: bookingContinue || missingBeforeBooking.length === 0 || invalid.length === 0,
        timing_ms: result.timing_ms,
        speak,
      },
      wf,
    );
  }

  if (result.status === "FIELD_NOT_ENABLED") {
    const wf = result.workflow;
    const stage = wf?.voice_v2_next_stage as VoiceV2NextStage | undefined;
    const bookingContinue = wf?.booking_continue_required === true;
    let speak =
      missingBeforeBooking.length === 0
        ? "That detail is not collected on this line. Continue with find availability."
        : "That field is not collected on this line. Continue with the remaining required details only.";
    const wfSpeak = speakForWorkflowStage(stage, bookingContinue, missingBeforeBooking);
    if (wfSpeak && missingBeforeBooking.length === 0) speak = wfSpeak;

    return mergeWorkflowFields(
      {
        ok: true,
        status: "FIELD_NOT_ENABLED",
        voice_v2_status: "FIELD_NOT_ENABLED",
        ignored_fields: result.ignored_fields,
        saved_fields: result.saved_fields,
        disabled_fields: result.ignored_fields,
        missingBeforeBooking,
        readiness: result.readiness,
        continue: true,
        timing_ms: result.timing_ms,
        speak,
      },
      wf,
    );
  }

  if (result.status === "SCHEDULING_PREFERENCE_NOTED") {
    const wf = result.workflow;
    const stage = wf?.voice_v2_next_stage as VoiceV2NextStage | undefined;
    const speak =
      missingBeforeBooking.length > 0
        ? "Got it. Ask only for the missing caller details — do not ask for the day again."
        : speakForWorkflowStage(stage, wf?.booking_continue_required === true, missingBeforeBooking) ||
          "Got it.";
    return mergeWorkflowFields(
      {
        ok: true,
        status: "SCHEDULING_PREFERENCE_NOTED",
        voice_v2_status: "SCHEDULING_PREFERENCE_NOTED",
        requested_date: result.requested_date,
        saved_fields: [],
        saved: [],
        missingBeforeBooking,
        readiness: result.readiness,
        continue: true,
        timing_ms: result.timing_ms,
        speak,
      },
      wf,
    );
  }

  if (result.status === VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS) {
    return {
      ok: false,
      status: VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS,
      voice_v2_status: VOICE_V2_BOOKING_INTENT_CONVERSATION_ONLY_STATUS,
      voice_v2_law_violation: result.law,
      continue: true,
      booking_continue_required: true,
      forbidden_actions: ["voice_v2_save_intake_fields"],
      runtime_hint:
        "Caller expressed booking intent only. Respond in conversation immediately — do not call save_intake for intent. Ask what day works or collect the next real field.",
      timing_ms: result.timing_ms,
      speak:
        "Absolutely — what day works best for you? Do not call intake save for booking intent alone.",
    };
  }

  if (result.status === "INTAKE_VALIDATION_ERROR") {
    const noFields =
      result.invalid_fields.length === 0 && result.disabled_fields.length === 0;
    return {
      ok: false,
      status: "INTAKE_VALIDATION_ERROR",
      voice_v2_status: "INTAKE_VALIDATION_ERROR",
      invalid_fields: result.invalid_fields,
      disabled_fields: result.disabled_fields,
      continue: true,
      timing_ms: result.timing_ms,
      runtime_hint: noFields
        ? "Tool payload was empty — include fields.email (and any other values the caller just gave) on voice_v2_save_intake_fields."
        : undefined,
      speak: noFields
        ? "Include the caller's email in fields.email on save_intake, then continue."
        : result.invalid_fields.includes("email")
          ? "Repeat the email once more — say it like anthony at example dot com, or with an at sign."
          : "I didn't catch that correctly. Could you repeat it?",
    };
  }

  return {
    ok: false,
    status: "SESSION_UNAVAILABLE",
    voice_v2_status: "SESSION_UNAVAILABLE",
    continue: false,
    timing_ms: result.timing_ms,
    speak: "Okay.",
  };
}
