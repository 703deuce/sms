import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { createId } from "@/lib/supabase/id";
import type { ReviewCandidate } from "./types";
import { isSemanticDuplicateService, normalizeServiceName } from "./normalize-facts";

function ensureKnowledgeItem(
  state: AppointmentReceptionistWizardState,
  id: string,
  label: string,
): AppointmentReceptionistWizardState["knowledgeItems"][number] {
  const existing = state.knowledgeItems.find((k) => k.id === id);
  if (existing) return existing;
  const item = {
    id,
    label,
    summary: "",
    status: "complete" as const,
    statusLabel: "Imported",
  };
  state.knowledgeItems.push(item);
  return item;
}

export function applySelectedCandidates(
  state: AppointmentReceptionistWizardState,
  selected: ReviewCandidate[],
): AppointmentReceptionistWizardState {
  const next: AppointmentReceptionistWizardState = {
    ...state,
    knowledgeItems: [...(state.knowledgeItems || [])],
    appointmentTypes: [...(state.appointmentTypes || [])],
  };

  for (const c of selected) {
    if (!c.selectedByDefault && !(c as { userSelected?: boolean }).userSelected) {
      // caller must set userSelected on apply — we treat all passed rows as selected
    }

    if (c.fieldPath === "businessName" && c.classification !== "SEMANTIC_DUPLICATE") {
      next.businessName = c.proposedValue;
    }
    if (c.fieldPath === "websiteUrl") {
      next.websiteUrl = c.proposedValue;
    }
    if (c.fieldPath === "knowledgeItems.business") {
      const item = ensureKnowledgeItem(next, "business", "Business details");
      item.summary = c.proposedValue;
      item.status = "owner_approved";
      item.statusLabel = "Imported from website";
    }
    if (c.fieldPath === "knowledgeItems.hours") {
      const item = ensureKnowledgeItem(next, "hours", "Hours");
      item.summary = c.proposedValue;
      item.status = "owner_approved";
      item.statusLabel = "Imported from website";
    }
    if (c.fieldPath === "knowledgeItems.service_area") {
      const item = ensureKnowledgeItem(next, "service_area", "Service areas");
      const parts = item.summary
        ? item.summary.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
        : [];
      if (!parts.some((p) => p.toLowerCase() === c.proposedValue.toLowerCase())) {
        parts.push(c.proposedValue);
      }
      item.summary = parts.join(", ");
      item.status = "owner_approved";
      item.statusLabel = "Imported from website";
    }
    if (c.fieldPath === "knowledgeItems.faqs") {
      const item = ensureKnowledgeItem(next, "faqs", "FAQs");
      const block = item.summary?.trim();
      item.summary = block ? `${block}\n\n${c.proposedValue}` : c.proposedValue;
      item.status = "owner_approved";
      item.statusLabel = "Imported from website";
    }
    if (c.fieldPath === "appointmentTypes") {
      if (c.classification === "SEMANTIC_DUPLICATE") {
        continue;
      }
      const exists = next.appointmentTypes.some(
        (t) => normalizeServiceName(t.name) === normalizeServiceName(c.proposedValue),
      );
      if (!exists) {
        next.appointmentTypes.push({
          id: createId(),
          name: c.proposedValue,
          durationMin: 60,
          calendar: "Main Calendar",
          status: "ready",
          requiredFields: ["full_name", "phone", "service"],
          bookingPermission: "book_directly",
          enabled: true,
        });
      }
      const servicesItem = ensureKnowledgeItem(next, "services", "Services");
      const names = [
        ...next.appointmentTypes.filter((t) => t.enabled).map((t) => t.name),
        ...(servicesItem.summary || "").split(/[,;\n]/).map((s) => s.trim()),
      ].filter(Boolean);
      const unique = [...new Set(names.map((n) => n.trim()))].filter(
        (n, i, arr) => arr.findIndex((x) => normalizeServiceName(x) === normalizeServiceName(n)) === i,
      );
      servicesItem.summary = unique.join(", ");
      servicesItem.status = "owner_approved";
    }
  }

  for (const c of selected) {
    if (c.classification === "SEMANTIC_DUPLICATE" && c.semanticMatchId) {
      // User chose "same service" — no new appointment type
      continue;
    }
  }

  return next;
}

export function mergeSemanticDuplicateAsSame(
  state: AppointmentReceptionistWizardState,
  candidate: ReviewCandidate,
): AppointmentReceptionistWizardState {
  if (candidate.classification !== "SEMANTIC_DUPLICATE") return state;
  return state;
}
