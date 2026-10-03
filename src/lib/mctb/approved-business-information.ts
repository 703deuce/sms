import "server-only";

import { loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";

const BLOCKED_FACT_STATUSES = new Set([
  "extracted",
  "pending_review",
  "rejected",
  "missing",
  "outdated",
]);

export type MctbApprovedBusinessInformation = {
  business_name: string;
  business_hours: string | null;
  services: string[];
  locations: Array<{ name: string; address?: string }>;
  website: string | null;
  knowledge_facts: Array<{ label: string; summary: string }>;
  about_business: string | null;
  /** Bounded text for Lead Recovery semantic / FAQ answering */
  prompt_block: string;
};

function isApprovedKnowledgeStatus(status?: string): boolean {
  const s = (status || "").trim().toLowerCase();
  if (!s) return false;
  if (BLOCKED_FACT_STATUSES.has(s)) return false;
  return true;
}

/**
 * Workspace-scoped approved business information for MCTB Lead Recovery FAQ.
 * Uses shared Company Brain (`workspace.customFieldsConfig.businessBrain`) via
 * `loadBusinessBrain` without a Voice agent id — no Voice V3 agent KB / RAG.
 */
export async function loadMctbApprovedBusinessInformation(
  workspaceId: string,
): Promise<MctbApprovedBusinessInformation> {
  const brain = await loadBusinessBrain(workspaceId);

  const knowledge_facts = (brain.knowledgeFacts || [])
    .filter((f) => isApprovedKnowledgeStatus(f.status))
    .map((f) => ({
      label: f.label.trim(),
      summary: f.summary.trim(),
    }))
    .filter((f) => f.label && f.summary)
    .slice(0, 25);

  const services = (brain.services || []).map((s) => s.name.trim()).filter(Boolean).slice(0, 30);
  const locations = (brain.locations || []).map((l) => ({
    name: l.name,
    address: l.address?.trim() || undefined,
  }));

  const business_hours = brain.businessHoursSummary?.trim() || null;
  const website = brain.website?.trim() || null;
  const about_business = brain.aboutBusiness?.trim() || null;

  const lines: string[] = [
    `Business name: ${brain.businessName}`,
  ];
  if (about_business) {
    lines.push("", "About the business:", about_business.slice(0, 4_000));
  }
  if (business_hours) lines.push(`Business hours: ${business_hours}`);
  if (website) lines.push(`Website: ${website}`);
  if (services.length) lines.push(`Services offered: ${services.join(", ")}`);
  if (locations.length) {
    for (const loc of locations.slice(0, 5)) {
      lines.push(
        `Location: ${loc.name}${loc.address ? ` — ${loc.address}` : ""}`,
      );
    }
  }
  for (const fact of knowledge_facts) {
    lines.push(`${fact.label}: ${fact.summary}`);
  }

  const prompt_block = lines.join("\n").slice(0, 4_000);

  return {
    business_name: brain.businessName,
    business_hours,
    services,
    locations,
    website,
    knowledge_facts,
    about_business,
    prompt_block,
  };
}
