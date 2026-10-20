/**
 * Hydrate wizard state from Company Brain when hire=amy skips the Information step.
 */

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type { BusinessBrain } from "@/lib/agents/appointment-booking/types";

export function wizardPatchFromCompanyBrain(
  brain: Partial<BusinessBrain> | null | undefined,
): Partial<AppointmentReceptionistWizardState> {
  if (!brain) return {};

  const knowledgeItems = (brain.knowledgeFacts || []).map((f, i) => ({
    id: `brain_${i}`,
    label: f.label,
    summary: f.summary,
    status: (f.status === "owner_approved" || f.status === "complete"
      ? "complete"
      : "complete") as "complete",
    statusLabel: "From Company Brain",
  }));

  const servicesFact = knowledgeItems.find((k) => /service/i.test(k.label));
  const appointmentTypes = (brain.services || []).map((s) => ({
    id: s.id,
    name: s.name,
    durationMin: s.durationMinutes || 60,
    calendar: "",
    status: "ready" as const,
    requiredFields: ["full_name", "phone", "service"],
    bookingPermission: "book_directly" as const,
    enabled: true,
  }));

  return {
    businessName: brain.businessName || undefined,
    websiteUrl: brain.website || undefined,
    timezone: brain.defaultTimezone || undefined,
    knowledgeItems: knowledgeItems.length ? knowledgeItems : undefined,
    ...(brain.businessHoursSummary
      ? {
          knowledgeItems: [
            ...(knowledgeItems.length ? knowledgeItems : []),
            {
              id: "brain_hours",
              label: "Business hours",
              summary: brain.businessHoursSummary,
              status: "complete" as const,
              statusLabel: "From Company Brain",
            },
          ],
        }
      : {}),
    ...(appointmentTypes.length ? { appointmentTypes } : {}),
    ...(servicesFact && !appointmentTypes.length
      ? {
          knowledgeItems: [
            ...(knowledgeItems.length ? knowledgeItems : []),
            servicesFact,
          ],
        }
      : {}),
  };
}
