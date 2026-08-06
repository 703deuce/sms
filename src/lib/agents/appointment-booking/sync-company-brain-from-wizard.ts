/**
 * Write company-scoped wizard answers into Company Brain (canonical).
 * Amy continues to retrieve these; she must not keep a second editable copy.
 */

import { saveBusinessBrainPartial } from "@/lib/agents/appointment-booking/business-brain";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

export async function syncCompanyBrainFromWizard(
  workspaceId: string,
  state: AppointmentReceptionistWizardState,
): Promise<void> {
  const services = (state.appointmentTypes || [])
    .filter((t) => t.enabled !== false)
    .map((t) => ({
      id: t.id,
      name: t.name,
      // Duration is Amy-owned — do not treat Brain as editable duration source
    }));

  const knowledgeFacts = (state.knowledgeItems || [])
    .filter((k) => {
      const status = String(k.status || "").toLowerCase();
      return (
        status === "complete" ||
        status === "owner_approved" ||
        status === "confirmed"
      );
    })
    .map((k) => ({
      label: k.label,
      summary: k.summary,
      status: "owner_approved",
    }));

  const transfers =
    state.transferDestinationName || state.transferDestinationPhone
      ? [
          {
            id: "primary_transfer",
            name: state.transferDestinationName || "Transfer",
            phone: state.transferDestinationPhone || undefined,
          },
        ]
      : [];

  await saveBusinessBrainPartial(workspaceId, {
    businessName: state.businessName || undefined,
    website: state.websiteUrl || undefined,
    defaultTimezone: state.timezone || undefined,
    services: services.length ? services : undefined,
    transferDestinations: transfers.length ? transfers : undefined,
    knowledgeFacts: knowledgeFacts.length ? knowledgeFacts : undefined,
  });
}
