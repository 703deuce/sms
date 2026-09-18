import { z } from "zod";

export const callerGoalTypeSchema = z.enum([
  "BOOK_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "CANCEL_APPOINTMENT",
  "CALLBACK",
  "TRANSFER",
  "GENERAL_INFORMATION",
]);

export const callerGoalDispositionSchema = z.enum([
  "START",
  "CONTINUE",
  "CHANGE",
  "ABANDON",
]);

export const callerGoalMeaningSchema = z.object({
  type: callerGoalTypeSchema,
  disposition: callerGoalDispositionSchema,
});

export type CallerGoalMeaning = z.infer<typeof callerGoalMeaningSchema>;

export const callerGoalsZodArray = z.array(callerGoalMeaningSchema);
