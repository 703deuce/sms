import "server-only";

import {
  loadMctbApprovedBusinessInformation,
  type MctbApprovedBusinessInformation,
} from "@/lib/mctb/approved-business-information";
import { loadMctbHandoffConfig } from "@/lib/mctb/handoff/config";

export const LEAD_RECOVERY_KNOWLEDGE_GROUNDING_RULES = `Use only the business knowledge sections below as factual sources for business-specific answers and urgency/emergency classification.
Never invent services, service areas, prices, hours, policies, availability, or emergency handling contrary to the business definition.
Urgency (customer wants help soon) is not the same as EMERGENCY — classify EMERGENCY only when the situation matches the business emergency definition (if provided) or clear life-safety risk.
When you cannot answer from supplied knowledge, set needs_clarification or use appropriate intent without fabricating facts.
Do not promise dispatch times, prices, or outcomes unless explicitly supported by configured knowledge or workflow.`;

export type MctbLeadRecoveryKnowledgeBundle = {
  about_business: string | null;
  emergency_criteria: string | null;
  emergency_detection_enabled: boolean;
  approved: MctbApprovedBusinessInformation;
  /** Full block for LLM prompts (FAQ, intent context) */
  runtime_prompt_block: string;
};

function trimBlock(text: string | null | undefined, max = 8_000): string {
  const t = (text || "").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 3)}...` : t;
}

export function composeLeadRecoveryRuntimePromptBlock(input: {
  approved: MctbApprovedBusinessInformation;
  aboutBusiness: string | null;
  emergencyCriteria: string | null;
  emergencyDetectionEnabled: boolean;
}): string {
  const sections: string[] = ["BUSINESS", `Business name: ${input.approved.business_name}`];

  const about = trimBlock(input.aboutBusiness, 6_000);
  if (about) {
    sections.push("", "ABOUT THE BUSINESS", about);
  }

  if (input.approved.business_hours) {
    sections.push("", "BUSINESS HOURS", input.approved.business_hours);
  }
  if (input.approved.website) {
    sections.push(`Website: ${input.approved.website}`);
  }
  if (input.approved.services.length) {
    sections.push("", "SERVICES", input.approved.services.join(", "));
  }
  if (input.approved.locations.length) {
    sections.push("", "SERVICE AREA / LOCATIONS");
    for (const loc of input.approved.locations.slice(0, 8)) {
      sections.push(
        `${loc.name}${loc.address ? ` — ${loc.address}` : ""}`,
      );
    }
  }
  for (const fact of input.approved.knowledge_facts) {
    sections.push(`${fact.label}: ${fact.summary}`);
  }

  if (input.emergencyDetectionEnabled) {
    const criteria = trimBlock(input.emergencyCriteria, 3_000);
    sections.push(
      "",
      "EMERGENCY / URGENT DEFINITION (business-specific — not generic world knowledge)",
      criteria ||
        "(No business emergency criteria configured — do not classify EMERGENCY unless clear immediate threat to life/safety; prefer HIGH urgency or needs_clarification.)",
    );
  }

  sections.push("", "GROUNDING", LEAD_RECOVERY_KNOWLEDGE_GROUNDING_RULES);

  return sections.join("\n").slice(0, 12_000);
}

export async function loadMctbLeadRecoveryKnowledgeBundle(
  workspaceId: string,
): Promise<MctbLeadRecoveryKnowledgeBundle> {
  const [approved, handoff, brainModule, lrConfig] = await Promise.all([
    loadMctbApprovedBusinessInformation(workspaceId),
    loadMctbHandoffConfig(workspaceId),
    import("@/lib/agents/appointment-booking/business-brain").then((m) =>
      m.loadBusinessBrain(workspaceId),
    ),
    import("@/lib/mctb/lead-recovery/config").then((m) =>
      m.loadLeadRecoveryConfigPersisted(workspaceId),
    ),
  ]);

  const about_business = trimBlock(brainModule.aboutBusiness, 6_000) || null;
  const emergency_criteria = handoff.emergencyCriteria?.trim() || null;

  let runtime_prompt_block = composeLeadRecoveryRuntimePromptBlock({
    approved,
    aboutBusiness: about_business,
    emergencyCriteria: emergency_criteria,
    emergencyDetectionEnabled: handoff.emergencyDetectionEnabled,
  });

  const { enabledSmsCollectPrompts } = await import(
    "@/lib/mctb/ai-recovery/collect-field-schema"
  );
  const prompts = enabledSmsCollectPrompts(lrConfig.smsCollectFields ?? []);
  if (prompts.length) {
    const lines = prompts.map(
      (p) =>
        `- ${p.label}${p.required ? " (required)" : ""}: ${p.prompt}${p.custom ? " [custom]" : ""}`,
    );
    runtime_prompt_block += `\n\nINFORMATION TO COLLECT (when needed — one question at a time, after answering the customer):\n${lines.join("\n")}`;
    if (lrConfig.allowDynamicCustomQuestions) {
      runtime_prompt_block +=
        "\nYou may ask one brief clarifying question not listed above when it clearly helps follow up (e.g. a detail the customer raised). Do not invent required compliance fields.";
    }
  }

  return {
    about_business,
    emergency_criteria,
    emergency_detection_enabled: handoff.emergencyDetectionEnabled,
    approved,
    runtime_prompt_block,
  };
}
