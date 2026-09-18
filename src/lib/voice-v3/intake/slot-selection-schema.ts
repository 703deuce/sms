import { z } from "zod";

export const slotSelectionTypeSchema = z.enum([
  "EXACT_TIME",
  "ORDINAL",
  "EARLIEST",
  "LATEST",
  "ACCEPT_SINGLE_OFFER",
  "NONE",
]);

export const slotSelectionMeaningZodObject = z.object({
  selection_type: slotSelectionTypeSchema,
  spoken_time: z.string().nullable(),
  ordinal: z.number().int().nullable(),
});

export type SlotSelectionMeaning = z.infer<typeof slotSelectionMeaningZodObject>;

export function emptySlotSelectionMeaning(): SlotSelectionMeaning {
  return {
    selection_type: "NONE",
    spoken_time: null,
    ordinal: null,
  };
}

export function slotSelectionMeaningHasSignal(meaning: SlotSelectionMeaning): boolean {
  return meaning.selection_type !== "NONE";
}
