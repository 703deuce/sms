import type { QualificationDefinition } from "./types";

/** Minimal tenant-agnostic starting point — customize per business in the agent builder. */
export function createDefaultQualificationDefinition(input: {
  businessName: string;
  id?: string;
}): QualificationDefinition {
  const businessName = input.businessName.trim() || "Your business";
  return {
    id: input.id || "new-lead-qualification",
    label: `New lead qualification — ${businessName}`,
    businessName,
    agentDisplayName: "Amy",
    reasonForContact: "You recently requested information from us.",
    introTemplate:
      "Hi, is this {leadName}? This is {agentDisplayName} with {businessName}. {reason} Do you have a minute for a few quick questions?",
    closeTemplate:
      "Perfect, I've got everything I need. I'll pass this along to the team at {businessName} so someone can follow up with you. Thanks for your time!",
    business: {
      name: businessName,
      description: `${businessName} follows up on new leads to learn what the caller needs.`,
      services: [],
      serviceAreas: [],
      knowledgeNotes: [],
      qaPairs: [],
    },
    campaign: {
      type: "new_lead_follow_up",
      reasonForContact: "Follow up on a new lead who requested information.",
      callerExplanation: "You recently requested information from us.",
      skipFieldIds: ["name", "callback_phone"],
    },
    authorityBoundaries: [
      "Do NOT invent specific inventory, listings, prices, or availability you do not have authoritative data for.",
      "Do NOT claim approval, financing qualification, or guarantees you cannot verify on this call.",
      "Do NOT book appointments or promise an exact callback time unless configured to do so.",
      "Do NOT tell the caller they financially 'qualify' unless a configured rule explicitly allows that wording.",
    ],
    allowedOutcomes: [
      "QUALIFIED",
      "NOT_QUALIFIED",
      "NOT_INTERESTED",
      "NURTURE",
      "CALLBACK_REQUESTED",
      "WRONG_NUMBER",
      "COMPLETED_INTAKE",
    ],
    fields: [
      {
        field_id: "name",
        label: "Name",
        type: "text",
        required: true,
        collection_instruction: "Confirm their name if not already known.",
      },
      {
        field_id: "callback_phone",
        label: "Callback phone",
        type: "phone",
        required: false,
        collection_instruction: "Best number to reach them if different from this line.",
      },
      {
        field_id: "need_summary",
        label: "What they are looking for",
        type: "long_text",
        required: true,
        collection_instruction: "What service, product, or outcome they want.",
      },
      {
        field_id: "timeframe",
        label: "Timeframe",
        type: "text",
        required: true,
        collection_instruction: "When they need help or hope to move forward.",
      },
      {
        field_id: "additional_notes",
        label: "Additional notes",
        type: "long_text",
        required: false,
        collection_instruction: "Anything else useful for human follow-up.",
      },
    ],
    rules: [
      { outcome: "NOT_INTERESTED", requireInterested: false },
      {
        outcome: "QUALIFIED",
        requiredFields: ["need_summary", "timeframe"],
        requireInterested: true,
      },
      { outcome: "NOT_QUALIFIED", requireInterested: true },
    ],
  };
}
