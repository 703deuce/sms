import { z } from "zod";

export const cancellationConfirmationSchema = z.enum(["NONE", "CONFIRM", "DECLINE"]);

export type CancellationConfirmation = z.infer<typeof cancellationConfirmationSchema>;

export function emptyCancellationConfirmation(): CancellationConfirmation {
  return "NONE";
}
