import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

/** Production Harbor Drain Pros content for Amy (866 line). */
export const HARBOR_DRAIN_PROS_WIZARD_CONTENT = {
  businessName: "Harbor Drain Pros",
  industry: "Plumbing & Drain Services",
  phoneNumberE164: "+18663464256",
  websiteUrl: "https://harbordrainpros.com",
  timezone: "America/Los_Angeles",
  businessDescription:
    "Harbor Drain Pros is a licensed residential and commercial plumbing company serving the San Francisco Bay Area. " +
    "We clear clogged drains, repair sewer lines, hydro-jet main lines, service and replace water heaters, detect leaks, " +
    "and dispatch 24/7 emergency plumbers for backups, burst pipes, and no-water situations. " +
    "Licensed and insured California plumbing contractor. Main office: San Francisco, CA.",
  businessHours:
    "Monday–Friday 8:00 AM–6:00 PM Pacific. Saturday 9:00 AM–1:00 PM Pacific (emergency and urgent calls only). Sunday closed.",
  serviceArea:
    "San Francisco, Oakland, Berkeley, Daly City, South San Francisco, and surrounding Bay Area communities.",
  coreServices:
    "Drain cleaning and clog removal, main sewer line repair, sewer camera inspection, hydro-jetting, " +
    "water heater repair and replacement, emergency plumbing, leak detection, fixture repair, garbage disposal service.",
  pricingNotes:
    "Standard diagnostic / service visit typically $89–$129 depending on the job. After-hours emergency dispatch starts at $149. " +
    "Exact repair pricing is provided on-site after diagnosis — never quote a final repair total without an on-site assessment.",
  importantFacts:
    "Fully licensed and insured. Same-day service available Monday–Saturday during business hours when technicians are available. " +
    "We do not perform new construction rough-in plumbing — service, repair, and replacement only.",
  businessAddress: "San Francisco, CA",
  greeting:
    "Thank you for calling Harbor Drain Pros. This is Amy, your appointment booking agent. How may I help you today?",
};

export function harborDrainProsKnowledgeItems(): AppointmentReceptionistWizardState["knowledgeItems"] {
  const c = HARBOR_DRAIN_PROS_WIZARD_CONTENT;
  return [
    {
      id: "business",
      label: "Business details",
      summary: `${c.businessName} — ${c.businessDescription} Address: ${c.businessAddress}. Phone: ${c.phoneNumberE164}. Website: ${c.websiteUrl}.`,
      status: "complete",
      statusLabel: "Configured",
    },
    {
      id: "hours",
      label: "Hours",
      summary: c.businessHours,
      status: "complete",
      statusLabel: "Configured",
    },
    {
      id: "services",
      label: "Services",
      summary: `${c.coreServices} Service area: ${c.serviceArea}`,
      status: "complete",
      statusLabel: "Configured",
    },
    {
      id: "pricing",
      label: "Pricing",
      summary: c.pricingNotes,
      status: "complete",
      statusLabel: "Configured",
    },
    {
      id: "faqs",
      label: "FAQs",
      summary:
        "What do you guys do? We are a full-service drain and plumbing company — drain clogs, sewer lines, water heaters, and emergency plumbing. " +
        "Do you offer same-day service? Yes, for most drain and plumbing calls Monday–Saturday during business hours when a technician is available. " +
        "Are you licensed? Yes — fully licensed and insured California plumbing contractor.",
      status: "complete",
      statusLabel: "Configured",
    },
    {
      id: "policies",
      label: "Policies",
      summary:
        "24-hour cancellation notice is appreciated. 90-day warranty on drain-cleaning workmanship. Payment due at job completion; major credit cards accepted. " +
        c.importantFacts,
      status: "complete",
      statusLabel: "Configured",
    },
  ];
}

/** Merge Harbor Drain Pros facts into an existing wizard snapshot. */
export function applyHarborDrainProsWizardKnowledge(
  state: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  const c = HARBOR_DRAIN_PROS_WIZARD_CONTENT;
  const knowledgeById = new Map(harborDrainProsKnowledgeItems().map((item) => [item.id, item]));
  const mergedKnowledge = (state.knowledgeItems || []).map((item) => knowledgeById.get(item.id) || item);
  for (const item of harborDrainProsKnowledgeItems()) {
    if (!mergedKnowledge.some((k) => k.id === item.id)) mergedKnowledge.push(item);
  }

  return {
    ...state,
    businessName: c.businessName,
    phoneNumberE164: state.phoneNumberE164 || c.phoneNumberE164,
    websiteUrl: c.websiteUrl,
    timezone: c.timezone,
    openingGreeting: state.openingGreeting?.includes("Harbor Drain Pros")
      ? state.openingGreeting
      : c.greeting,
    knowledgeItems: mergedKnowledge,
  };
}
