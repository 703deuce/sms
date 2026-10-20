import { z } from "zod";

export const appointmentSelectionMeaningZodObject = z.object({
  selection_type: z.enum(["ORDINAL", "NONE"]),
  ordinal: z.number().int().nullable(),
});

export type AppointmentSelectionMeaning = z.infer<typeof appointmentSelectionMeaningZodObject>;

export function emptyAppointmentSelectionMeaning(): AppointmentSelectionMeaning {
  return { selection_type: "NONE", ordinal: null };
}

export function appointmentSelectionHasSignal(meaning: AppointmentSelectionMeaning): boolean {
  return meaning.selection_type !== "NONE" && meaning.ordinal !== null;
}
