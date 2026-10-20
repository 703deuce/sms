import { compileBusinessHoursAmyDisplay } from "../../voice-v3/config/business-hours-display";
import type { VoiceV2BusinessScheduleConfig } from "../../voice-receptionist-wizard/operating-maturity/types";
import { upsertKnowledgeItem } from "./knowledge-items-helpers";
import type { AppointmentReceptionistWizardState } from "./types";

/** Pure: derive hours knowledge item from structured schedule (authority), ignoring stale prose. */
export function applyDerivedHoursKnowledgeItem(
  knowledgeItems: AppointmentReceptionistWizardState["knowledgeItems"],
  businessSchedule: VoiceV2BusinessScheduleConfig,
): AppointmentReceptionistWizardState["knowledgeItems"] {
  const compiled = compileBusinessHoursAmyDisplay({
    structuredSchedule: businessSchedule,
    hoursKnowledgeProse: null,
  });
  const display = compiled.hoursDisplay?.trim();
  if (!display) return knowledgeItems;
  return upsertKnowledgeItem(knowledgeItems, "hours", {
    label: "Hours",
    summary: display,
    status: "complete",
    statusLabel: "From business hours",
  });
}

/** Brain sync reads hours item with status complete — matches syncCompanyBrainFromWizard filter. */
export function brainHoursSummaryFromKnowledgeItems(
  knowledgeItems: AppointmentReceptionistWizardState["knowledgeItems"],
): string | undefined {
  const hoursItem = knowledgeItems.find((k) => k.id === "hours" || /hour/i.test(k.label));
  const hoursSummary = (hoursItem?.summary || "").trim();
  const hoursApproved =
    hoursItem &&
    ["complete", "owner_approved", "confirmed"].includes(String(hoursItem.status || ""));
  return hoursApproved && hoursSummary ? hoursSummary : undefined;
}
