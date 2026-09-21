import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";

export type WizardFactSnapshot = {
  businessName: string;
  websiteUrl: string;
  knowledgeById: Record<string, string>;
  serviceNames: string[];
  faqLines: string[];
  hoursStructuredJson: string;
};

export function snapshotWizardFacts(state: AppointmentReceptionistWizardState): WizardFactSnapshot {
  const knowledgeById: Record<string, string> = {};
  for (const item of state.knowledgeItems || []) {
    const approved =
      item.status === "complete" ||
      item.status === "owner_approved" ||
      item.status === "extracted";
    if (approved && item.summary?.trim()) knowledgeById[item.id] = item.summary.trim();
  }
  const maturity = ensureWizardOperatingMaturity(state);
  return {
    businessName: (state.businessName || "").trim(),
    websiteUrl: (state.websiteUrl || "").trim(),
    knowledgeById,
    serviceNames: (state.appointmentTypes || [])
      .filter(
        (t) =>
          t.enabled &&
          !["initial", "service", "emergency"].includes(t.id),
      )
      .map((t) => t.name.trim())
      .filter(Boolean),
    faqLines: (knowledgeById.faqs || "")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean),
    hoursStructuredJson: JSON.stringify(maturity.businessSchedule || {}),
  };
}

const PLACEHOLDER_KNOWLEDGE =
  /not configured|add your|business hours by day|services callers can ask|common questions and answers|price ranges for key|cancellation, warranty/i;

export function isWizardEffectivelyEmpty(snap: WizardFactSnapshot): boolean {
  if (snap.businessName) return false;
  const configured = Object.entries(snap.knowledgeById).filter(
    ([, v]) => v && !PLACEHOLDER_KNOWLEDGE.test(v),
  );
  if (configured.length > 0) return false;
  if (snap.serviceNames.length > 0) return false;
  return true;
}
