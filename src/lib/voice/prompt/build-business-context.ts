import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { knowledgeRouteForItemId } from "./knowledge-classification";
import {
  normalizeWizardTransferPhone,
  wizardTransferDestinationName,
} from "@/lib/solutions/appointment-receptionist/transfer-utils";

function approvedKnowledgeItems(state: AppointmentReceptionistWizardState) {
  return (state.knowledgeItems || []).filter((item) => {
    const summary = (item.summary || "").trim();
    if (!summary) return false;
    if (item.status === "missing" || item.status === "pending_review") return false;
    if (item.status === "extracted" || item.status === "rejected" || item.status === "outdated") {
      return false;
    }
    return knowledgeRouteForItemId(item.id) === "PROMPT_CONTEXT";
  });
}

function itemById(state: AppointmentReceptionistWizardState, id: string) {
  return approvedKnowledgeItems(state).find((i) => i.id === id);
}

function sectionFromItem(item: { label: string; summary: string } | undefined): string {
  if (!item?.summary?.trim()) return "";
  return `${item.label}: ${item.summary.trim()}`;
}

/** Stable hash for cache/revision — not cryptographic. */
export function businessContextRevision(state: AppointmentReceptionistWizardState): string {
  const payload = JSON.stringify({
    businessName: state.businessName,
    items: approvedKnowledgeItems(state).map((i) => [i.id, i.summary, i.status]),
    caps: state.capabilities,
    types: (state.appointmentTypes || []).filter((t) => t.enabled).map((t) => t.name),
  });
  let h = 0;
  for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) | 0;
  return `bc-${(h >>> 0).toString(16)}`;
}

export type CompactBusinessSections = {
  businessInformation: string;
  businessHours: string;
  services: string;
  approvedPricing: string;
  commonQuestions: string;
  businessPolicies: string;
  serviceArea: string;
  callHandling: string;
};

export function buildCompactBusinessSections(
  state: AppointmentReceptionistWizardState,
): CompactBusinessSections {
  const lines: string[] = [];
  const business = state.businessName?.trim();
  if (business) lines.push(`Business: ${business}`);
  if (state.phoneNumberE164) lines.push(`Main phone: ${state.phoneNumberE164}`);
  if (state.websiteUrl?.trim()) lines.push(`Website: ${state.websiteUrl.trim()}`);
  if (state.timezone) lines.push(`Time zone: ${state.timezone}`);

  const businessInformation =
    [
      lines.join("\n"),
      sectionFromItem(itemById(state, "business")),
    ]
      .filter(Boolean)
      .join("\n") || "";

  const businessHours = sectionFromItem(itemById(state, "hours"));
  const services = sectionFromItem(itemById(state, "services"));
  const approvedPricing = sectionFromItem(itemById(state, "pricing"));
  const commonQuestions = sectionFromItem(itemById(state, "faqs"));
  const businessPolicies = sectionFromItem(itemById(state, "policies"));
  const serviceArea = sectionFromItem(itemById(state, "service_area"));

  const extraFacts = approvedKnowledgeItems(state)
    .filter((i) => !["business", "hours", "services", "pricing", "faqs", "policies", "service_area"].includes(i.id))
    .map((i) => `- ${i.label}: ${i.summary.trim()}`);

  const enabledTypes = (state.appointmentTypes || []).filter((t) => t.enabled);
  const bookingTargets = enabledTypes.length
    ? enabledTypes
        .map((t) => {
          const bits = [t.name, t.durationMin ? `${t.durationMin} min` : null, t.bookingHours || null].filter(
            Boolean,
          );
          return `- ${bits.join(" · ")}`;
        })
        .join("\n")
    : "";

  const transferName = wizardTransferDestinationName(state.transferDestinationName);
  const transferPhone = normalizeWizardTransferPhone(state.transferDestinationPhone);
  const callHandlingParts: string[] = [];
  if (state.capabilities.includes("transfer_calls") && transferPhone) {
    callHandlingParts.push(
      `Human transfer: ${transferName} (destination configured in runtime — do not invent numbers).`,
    );
    if (state.transferTriggers.length) {
      callHandlingParts.push(`Transfer when: ${state.transferTriggers.join("; ")}`);
    }
    callHandlingParts.push(`If transfer fails: ${state.transferFallback.replaceAll("_", " ")}`);
  }
  if (state.capabilities.includes("book_appointments")) {
    callHandlingParts.push(
      `Booking: ${state.calendarConnected ? "AI booking enabled when runtime permits scheduling tools" : "booking configured — calendar connection required for live availability"}`,
    );
    if (bookingTargets) callHandlingParts.push(`Booking targets:\n${bookingTargets}`);
  }
  if (state.answerWhen) {
    callHandlingParts.push(`Answer schedule mode: ${state.answerWhen.replaceAll("_", " ")}`);
  }

  const businessInformationWithExtras =
    [businessInformation, extraFacts.length ? `Additional facts:\n${extraFacts.join("\n")}` : ""]
      .filter(Boolean)
      .join("\n\n") || businessInformation;

  return {
    businessInformation: businessInformationWithExtras,
    businessHours,
    services,
    approvedPricing,
    commonQuestions,
    businessPolicies,
    serviceArea,
    callHandling: callHandlingParts.join("\n"),
  };
}

/** Back-compat export used by build-agent-config and tests. */
export function buildBusinessKnowledgePromptSection(
  state: AppointmentReceptionistWizardState,
): string {
  const s = buildCompactBusinessSections(state);
  const blocks: string[] = [];
  if (s.businessInformation) blocks.push(`Business knowledge:\n${s.businessInformation}`);
  if (s.businessHours) blocks.push(`Hours:\n${s.businessHours}`);
  if (s.services) blocks.push(`Services:\n${s.services}`);
  if (s.approvedPricing) blocks.push(`Pricing:\n${s.approvedPricing}`);
  if (s.commonQuestions) blocks.push(`FAQs:\n${s.commonQuestions}`);
  if (s.businessPolicies) blocks.push(`Policies:\n${s.businessPolicies}`);
  if (s.serviceArea) blocks.push(`Service area:\n${s.serviceArea}`);
  if (s.callHandling) blocks.push(`Call handling:\n${s.callHandling}`);
  return blocks.join("\n\n").trim();
}
