import { z } from "zod";

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

/** Shared strict schema for SchedulingMeaning (CallerMeaning + set_scheduling_preference). */
export const schedulingMeaningZodObject = z.object({
  date_expression: z
    .string()
    .nullable()
    .describe("Caller-facing date phrase for audit/display only; null if not spoken."),
  date_relation: schedulingDateRelationSchema.describe(
    "Semantic date relation — do not compute calendar dates in the model.",
  ),
  weekday: schedulingWeekdaySchema
    .nullable()
    .describe("Weekday when date_relation is THIS_WEEKDAY or NEXT_WEEKDAY; null otherwise."),
  explicit_date: z
    .string()
    .nullable()
    .describe("YYYY-MM-DD when date_relation is EXPLICIT_DATE; null otherwise."),
  time_expression: z
    .string()
    .nullable()
    .describe("Caller-facing time phrase for audit/display; null if not spoken."),
  time_kind: schedulingTimeKindSchema.describe(
    "Shape of time constraint (exact, daypart, before/after, range, anytime).",
  ),
  exact_time: z
    .string()
    .nullable()
    .describe("Local HH:MM for EXACT time_kind; null otherwise."),
  start_time: z
    .string()
    .nullable()
    .describe("Local HH:MM lower bound for AFTER or BETWEEN; null otherwise."),
  end_time: z
    .string()
    .nullable()
    .describe("Local HH:MM upper bound for BEFORE or BETWEEN; null otherwise."),
  daypart: schedulingDaypartSchema
    .nullable()
    .describe("MORNING, AFTERNOON, or EVENING when time_kind is DAYPART; null otherwise."),
});
