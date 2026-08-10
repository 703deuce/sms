import type {
  OutboundBusinessProfile,
  OutboundCampaignProfile,
  OutboundLeadContext,
  QualificationDefinition,
} from "./types";
import { mergeQualificationFields, missingRequiredFields } from "./qualification-evaluator";

const DEFAULT_AGENT_NAME = "Amy";

export type OutboundCallMission = {
  agentDisplayName: string;
  businessName: string;
  business: OutboundBusinessProfile | null;
  campaign: OutboundCampaignProfile | null;
  lead: OutboundLeadContext;
  qualification: QualificationDefinition;
  authorityBoundaries: string[];
};

export function resolveOutboundCallMission(input: {
  qualification: QualificationDefinition;
  lead: OutboundLeadContext;
}): OutboundCallMission {
  const { qualification, lead } = input;
  return {
    agentDisplayName: qualification.agentDisplayName?.trim() || DEFAULT_AGENT_NAME,
    businessName: qualification.businessName,
    business: qualification.business || null,
    campaign: qualification.campaign || null,
    lead,
    qualification,
    authorityBoundaries: qualification.authorityBoundaries || DEFAULT_AUTHORITY_BOUNDARIES,
  };
}

const DEFAULT_AUTHORITY_BOUNDARIES = [
  "Do NOT invent specific homes, addresses, listing prices, or MLS inventory.",
  "Do NOT claim mortgage approval, financing qualification, or that a specific property is available.",
  "Do NOT book appointments or promise an exact callback time.",
  "Do NOT tell the caller they 'qualify' in a financial or mortgage sense.",
];

export function prefillCollectedFields(input: {
  qualification: QualificationDefinition;
  lead: OutboundLeadContext;
}): Record<string, string> {
  const patch: Record<string, string> = {};

  if (input.lead.leadName?.trim()) {
    patch.name = input.lead.leadName.trim();
  }
  if (input.lead.leadPhone?.trim()) {
    patch.callback_phone = input.lead.leadPhone.trim();
  }

  const submitted = input.lead.submittedFields || {};
  for (const [key, value] of Object.entries(submitted)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) patch[key] = text;
  }

  const skipIds = new Set(input.qualification.campaign?.skipFieldIds || []);
  for (const fieldId of skipIds) {
    const established = input.qualification.campaign?.establishedIntent;
    if (fieldId === "buying_or_selling" && established) {
      patch.buying_or_selling = established.includes("sell") ? "selling" : "buying";
    }
  }

  return mergeQualificationFields({}, patch);
}

export function fieldIdsToSkipAsking(mission: OutboundCallMission): Set<string> {
  const skip = new Set(mission.campaign?.skipFieldIds || []);
  const established = mission.campaign?.establishedIntent?.trim();
  if (established) {
    skip.add("buying_or_selling");
    skip.add("intent");
  }
  return skip;
}

export function formatFieldManifestForPrompt(definition: QualificationDefinition): string {
  return definition.fields
    .map((f) => {
      const req = f.required ? "required" : "optional";
      const hint = f.collection_instruction ? ` — ${f.collection_instruction}` : "";
      return `- ${f.field_id} (${f.label}, ${req})${hint}`;
    })
    .join("\n");
}

export function formatKnownStateSummary(
  collected: Record<string, string>,
  mission: OutboundCallMission,
): string {
  const lines: string[] = [];
  if (mission.campaign?.establishedIntent) {
    lines.push(`Established intent: ${mission.campaign.establishedIntent}`);
  }
  if (mission.lead.leadSource) {
    lines.push(`Lead source: ${mission.lead.leadSource}`);
  }
  const entries = Object.entries(collected).filter(([, v]) => v.trim());
  if (entries.length) {
    lines.push(
      "Already captured (do NOT ask again unless clarifying):",
      ...entries.map(([k, v]) => `  - ${k}: ${v}`),
    );
  } else {
    lines.push("No fields captured yet.");
  }
  const missing = missingRequiredFields(mission.qualification, collected).filter(
    (id) => !fieldIdsToSkipAsking(mission).has(id),
  );
  if (missing.length) {
    lines.push(`Still need: ${missing.join(", ")}`);
  } else {
    lines.push("All required fields captured.");
  }
  return lines.join("\n");
}

export function formatBusinessContextBlock(business: OutboundBusinessProfile | null, businessName: string): string {
  if (!business) {
    return `Business: ${businessName} (no extended profile configured).`;
  }
  const parts = [`Business: ${businessName}`, business.description];
  if (business.services?.length) parts.push(`Services: ${business.services.join("; ")}`);
  if (business.serviceAreas?.length) parts.push(`Service areas: ${business.serviceAreas.join(", ")}`);
  if (business.propertyTypes?.length) parts.push(`Property types: ${business.propertyTypes.join(", ")}`);
  if (business.website) parts.push(`Website: ${business.website}`);
  if (business.knowledgeNotes?.length) {
    parts.push("Authoritative facts:", ...business.knowledgeNotes.map((f) => `- ${f}`));
  }
  return parts.join("\n");
}

export function formatCampaignContextBlock(campaign: OutboundCampaignProfile | null): string {
  if (!campaign) return "Campaign: generic new-lead follow-up.";
  const parts = [
    `Campaign type: ${campaign.type}`,
    `Why we are calling: ${campaign.callerExplanation || campaign.reasonForContact}`,
  ];
  if (campaign.source) parts.push(`Lead source: ${campaign.source}`);
  if (campaign.offerOrInterest) parts.push(`Their interest: ${campaign.offerOrInterest}`);
  if (campaign.establishedIntent) {
    parts.push(
      `Known intent: ${campaign.establishedIntent}. Do NOT ask unrelated generic sales questions or whether they are buying vs selling unless they correct you.`,
    );
  }
  return parts.join("\n");
}

function formatOpeningGuidance(guidance?: string | string[]): string {
  if (!guidance) return "";
  if (Array.isArray(guidance)) return guidance.filter(Boolean).join("\n");
  return guidance.trim();
}

export function resolveOutboundProfileBusinessAnswer(input: {
  business: OutboundBusinessProfile | null;
  businessName: string;
  topic: string;
}): string | null {
  const topic = input.topic.trim().toLowerCase();
  if (!topic) return null;

  const business = input.business;
  const name = business?.name || input.businessName;

  const topicIncludes = (...phrases: string[]) =>
    phrases.some((phrase) => topic.includes(phrase.toLowerCase()));

  if (
    topicIncludes("who are you", "what company", "real estate company", "who is this", "who are you guys")
  ) {
    return business?.description
      ? `${name} ${business.description}`
      : `${name} helps customers in our service area.`;
  }

  if (topicIncludes("listing", "mls", "house for", "available", "have any homes", "have any townhouses")) {
    return (
      `${name} helps buyers search available properties with a licensed realtor. ` +
      "I don't have live MLS inventory on this call, but I'll pass your criteria along so a realtor can follow up with options."
    );
  }

  if (topicIncludes("stafford", "woodbridge", "dale city", "manassas", "fredericksburg", "service area", "work in", "located")) {
    const areas = business?.serviceAreas;
    if (areas?.length) {
      const askedArea = areas.find((a) => topic.includes(a.toLowerCase()));
      if (askedArea) {
        return `Yes, ${name} works with buyers in ${askedArea} and nearby Northern Virginia communities.`;
      }
      return `We help buyers throughout ${areas.slice(0, 4).join(", ")}${areas.length > 4 ? ", and other nearby areas" : ""}.`;
    }
  }

  if (topicIncludes("condo", "townhouse", "single family", "single-family", "property type")) {
    const types = business?.propertyTypes;
    if (types?.length) {
      return `Yes, we help buyers with ${types.join(", ")}.`;
    }
  }

  for (const note of business?.knowledgeNotes || []) {
    if (topicIncludes(note.toLowerCase())) return note;
  }

  if (business?.description && topicIncludes("what do you do", "services", "what do you guys do")) {
    return business.description;
  }

  return null;
}

export function buildQualificationTaskInstructions(mission: OutboundCallMission): string {
  const { agentDisplayName, businessName, authorityBoundaries } = mission;
  const blocks = [
    `You are ${agentDisplayName}, calling on behalf of ${businessName} on a LIVE OUTBOUND phone call.`,
    "YOU initiated this call — never open with 'How can I help you?'",
    "",
    "=== BUSINESS CONTEXT ===",
    formatBusinessContextBlock(mission.business, businessName),
    "",
    "=== CAMPAIGN CONTEXT ===",
    formatCampaignContextBlock(mission.campaign),
    "",
    "=== YOUR JOB ===",
    mission.campaign?.callerExplanation ||
      mission.qualification.reasonForContact ||
      "Follow up on a lead who requested information.",
    "Naturally gather the configured qualification fields, save them with record_qualification_fields, then close the call.",
    "This is a conversation, not a rigid survey. If they give multiple answers at once, capture all of them.",
    "Never re-ask for information already captured unless they are correcting it.",
    "Use get_business_answer for questions about the company, service areas, or what you do — then return to qualification.",
    "Never read internal summaries, field lists, or tool results aloud to the caller.",
    "",
    "=== FIELDS TO COLLECT (field_id) ===",
    formatFieldManifestForPrompt(mission.qualification),
    "",
    "=== CALLER-FACING CLOSE ===",
    'When done, say one brief goodbye, then call set_qualification_outcome with complete.',
    "Never tell the caller they financially or mortgage 'qualify'.",
    "Never repeat goodbye, recap collected fields, or summarize the conversation at the end.",
    "",
    "=== AUTHORITY BOUNDARIES ===",
    ...authorityBoundaries.map((b) => `- ${b}`),
    "",
    "When intake is complete, call set_qualification_outcome with complete, wrong_number, not_interested, or callback_requested.",
  ];
  if (formatOpeningGuidance(mission.qualification.openingGuidance)) {
    blocks.splice(
      8,
      0,
      "",
      "=== OPENING GUIDANCE ===",
      formatOpeningGuidance(mission.qualification.openingGuidance),
    );
  }
  return blocks.join("\n");
}

export function buildOpeningReplyInstructions(mission: OutboundCallMission, collected: Record<string, string>): string {
  const name = mission.lead.leadName?.trim() || "there";
  const agent = mission.agentDisplayName;
  const company = mission.businessName;
  const why =
    mission.campaign?.callerExplanation ||
    mission.qualification.reasonForContact ||
    "You recently requested information from us.";

  const semanticChecklist = [
    `1. Confirm identity politely (e.g. "Hi, is this ${name}?")`,
    `2. Introduce yourself as ${agent} with ${company}`,
    `3. Explain why you are calling: ${why}`,
    "4. Mention you just need a few quick questions so the right person on the team can follow up",
    '5. Ask permission to continue (e.g. "Do you have a minute for a few quick questions?")',
  ].join("\n");

  const known = formatKnownStateSummary(collected, mission);

  return [
    "Deliver a natural outbound opening on this live call.",
    "Include ALL of these semantic elements (wording may vary):",
    semanticChecklist,
    "",
    "Do NOT ask 'How can I help you?' — you called them.",
    "Do NOT ask about unrelated topics like 'projects', generic sales pipelines, or buying vs selling if intent is already established.",
    "Do NOT jump into detailed qualification before explaining why you are calling.",
    "",
    "=== KNOWN BEFORE THIS CALL ===",
    known,
    "",
    formatOpeningGuidance(mission.qualification.openingGuidance),
  ]
    .filter(Boolean)
    .join("\n");
}
