import { z } from "zod";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import { slotSelectionMeaningZodObject } from "./slot-selection-schema";
import { appointmentSelectionMeaningZodObject } from "./appointment-selection-schema";
import { cancellationConfirmationSchema } from "./cancellation-confirmation-schema";
import { callerGoalsZodArray } from "./caller-goal-meaning";

const voiceV3GoalSchema = z.enum([
  "UNKNOWN",
  "GENERAL",
  "BOOK_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "REQUEST_CALLBACK",
  "REQUEST_TRANSFER",
]);

export const CALLER_MEANING_STRUCTURED_OUTPUT_NAME = "voice_v3_caller_meaning";

const schedulingDateRelationSchema = z.enum([
  "TODAY",
  "TOMORROW",
  "DAY_AFTER_TOMORROW",
  "THIS_WEEKDAY",
  "NEXT_WEEKDAY",
  "EXPLICIT_DATE",
  "UNSPECIFIED",
]);

const schedulingWeekdaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const schedulingTimeKindSchema = z.enum([
  "EXACT",
  "AFTER",
  "BEFORE",
  "BETWEEN",
  "DAYPART",
  "ANYTIME",
  "UNSPECIFIED",
]);

const schedulingDaypartSchema = z.enum(["MORNING", "AFTERNOON", "EVENING"]);

const postBookIntentSchema = z.enum(["NONE", "CHANGE_CONFIRMED_APPOINTMENT"]);

export const schedulingMeaningZodObject = z.object({
  date_expression: z.string().nullable(),
  date_relation: schedulingDateRelationSchema,
  weekday: schedulingWeekdaySchema.nullable(),
  explicit_date: z.string().nullable(),
  time_expression: z.string().nullable(),
  time_kind: schedulingTimeKindSchema,
  exact_time: z.string().nullable(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  daypart: schedulingDaypartSchema.nullable(),
});

function intakeFieldKeySchema(config: VoiceV3AgentConfig) {
  const keys = config.intakeFields.map((f) => f.key).filter(Boolean);
  if (keys.length === 0) {
    return z.never();
  }
  return z.enum(keys as [string, ...string[]]);
}

/**
 * Per-agent Structured Output schema — captured_fields[].key and corrections[].key
 * are enums of configured intake keys only.
 */
export function buildCallerMeaningZodSchema(config: VoiceV3AgentConfig) {
  const fieldKey = intakeFieldKeySchema(config);

  return z.object({
    active_goal: voiceV3GoalSchema,
    goals: callerGoalsZodArray.optional().default([]),
    captured_fields: z.array(
      z.object({
        key: fieldKey,
        value: z.string(),
        confidence: z.number(),
      }),
    ),
    scheduling: schedulingMeaningZodObject,
    corrections: z.array(
      z.object({
        key: fieldKey,
        new_value: z.string(),
        confidence: z.number(),
      }),
    ),
    ambiguities: z.array(
      z.object({
        field: z.string().nullable(),
        reason: z.string(),
      }),
    ),
    slot_selection: slotSelectionMeaningZodObject,
    post_book_intent: postBookIntentSchema,
    appointment_selection: appointmentSelectionMeaningZodObject,
    cancellation_confirmation: cancellationConfirmationSchema,
  });
}

export type CallerMeaning = z.infer<ReturnType<typeof buildCallerMeaningZodSchema>>;

export function configuredIntakeKeySet(config: VoiceV3AgentConfig): Set<string> {
  return new Set(config.intakeFields.map((f) => f.key));
}
