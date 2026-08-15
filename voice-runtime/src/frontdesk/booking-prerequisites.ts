import { missingReceptionistFields } from "@/lib/voice/receptionist/field-collection-scope";
import { resolveConfirmedEmail } from "./email-collection-tools";
import type { FrontDeskUserData } from "./userdata";

export type BookingPrerequisiteGap = {
  fieldId: string;
  label: string;
  kind: "email" | "field";
};

/** Fields that must be present before Calendly write — checked synchronously before blocking. */
export function findBookingPrerequisiteGaps(
  ud: FrontDeskUserData,
  inlineEmail?: string,
): BookingPrerequisiteGap[] {
  const gaps: BookingPrerequisiteGap[] = [];

  if (!resolveConfirmedEmail(ud, inlineEmail)) {
    gaps.push({ fieldId: "email", label: "email address", kind: "email" });
  }

  const manifest = ud.receptionistCompiled?.fieldManifest;
  if (manifest?.length) {
    const missing = missingReceptionistFields(manifest, ud.receptionistFields, "booking");
    for (const field of missing) {
      if (field.id === "email" && gaps.some((g) => g.fieldId === "email")) continue;
      gaps.push({
        fieldId: field.id,
        label: field.label?.trim() || field.id,
        kind: "field",
      });
    }
  }

  return gaps;
}
