import type { ReceptionistCompiledSnapshot } from "./types";
import { TRANSOVO_RECEPTIONIST_CONSTITUTION } from "./transovo-receptionist-constitution";
import { AMY_V2_CORE_STATIC_PROMPT } from "@/lib/voice-v2/one-amy/amy-core-static-prompt";
import { buildToolFeedbackVocabularyForPrompt } from "@/lib/voice/tool-feedback";
import { buildGeneratedWorkflowRules } from "./build-generated-workflow-rules";
import {
  extractHoursFromDescription,
  extractPricingFromDescription,
} from "@/lib/voice/knowledge/resolve-business-answer-helpers";

const ANSWER_WHEN_LABELS: Record<string, string> = {
  every_call: "Answer every incoming call",
  after_hours: "After business hours only",
  nobody_answers: "When staff does not answer",
  overflow: "Overflow / busy lines only",
};

const STYLE_LABELS: Record<string, string> = {
  friendly: "Friendly and warm",
  professional: "Professional and courteous",
  casual: "Casual and conversational",
};

const LENGTH_LABELS: Record<string, string> = {
  concise: "Concise",
  balanced: "Balanced",
  detailed: "Detailed when helpful",
};

function personalityFromSnapshot(snapshot: ReceptionistCompiledSnapshot): string {
  const conv = snapshot.conversationBehavior as {
    style?: string;
    responseLength?: string;
  } | undefined;
  const style = STYLE_LABELS[conv?.style || "professional"] || STYLE_LABELS.professional;
  const length = LENGTH_LABELS[conv?.responseLength || "balanced"] || LENGTH_LABELS.balanced;
  const lines = [
    `Name: ${snapshot.agentDisplayName}`,
    `Role: Receptionist for ${snapshot.businessName}`,
    `Personality: ${style}`,
    `Speaking style: ${length}`,
  ];
  if (snapshot.agentPersonalityNotes?.trim()) {
    lines.push(snapshot.agentPersonalityNotes.trim());
  }
  return lines.join("\n");
}

function synthesizeJobInstructions(snapshot: ReceptionistCompiledSnapshot): string {
  const business = snapshot.businessName.trim() || "the business";
  const bullets: string[] = [
    "Answer incoming calls.",
    "Determine why the caller is calling and help them appropriately.",
  ];
  if (snapshot.capabilities.includes("collect_info") && !snapshot.voiceV2IntakeAuthority) {
    const fields = snapshot.fieldManifest.map((f) => f.label).join(", ");
    bullets.push(
      fields
        ? `Collect caller information when needed: ${fields}.`
        : "Collect required caller information when needed.",
    );
  }
  if (snapshot.voiceV2IntakeAuthority && snapshot.voiceV2IntakeInstructions) {
    bullets.push(
      "For appointment booking intake, follow VOICE V2 INTAKE AUTHORITY only — not legacy collect-info chips.",
    );
  }
  if (snapshot.capabilities.includes("take_messages")) {
    bullets.push("Take messages when the caller cannot be helped immediately.");
  }
  if (snapshot.capabilities.includes("transfer_calls")) {
    bullets.push("Transfer callers when appropriate per configured policy.");
  }
  if (snapshot.capabilities.includes("book_appointments")) {
    bullets.push("Book appointments when requested and permitted.");
  }
  if (snapshot.capabilities.includes("send_text")) {
    bullets.push(
      "Send SMS when the caller asks for a text — use the send_sms tool; never say you cannot text.",
    );
  }
  return bullets.map((b) => `- ${b}`).join("\n");
}

function buildYourJobSection(snapshot: ReceptionistCompiledSnapshot): string {
  const job =
    snapshot.agentJobInstructions?.trim() || synthesizeJobInstructions(snapshot);
  return ["YOUR JOB", job].join("\n");
}

function buildAdditionalInstructionsSection(snapshot: ReceptionistCompiledSnapshot): string | null {
  const additional = snapshot.additionalInstructions?.trim();
  if (!additional) return null;
  return ["ADDITIONAL CUSTOMER INSTRUCTIONS", additional].join("\n");
}

function formatBulletBlock(raw: string | undefined): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  const lines = trimmed
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  return lines
    .map((line) => (line.startsWith("-") ? line : `- ${line}`))
    .join("\n");
}

function buildBusinessSection(snapshot: ReceptionistCompiledSnapshot): string {
  const profile = snapshot.businessProfile || {};
  const description = snapshot.businessDescription.trim();
  const hours =
    profile.hours?.trim() ||
    extractHoursFromDescription(description) ||
    undefined;
  const pricing =
    profile.pricingNotes?.trim() ||
    extractPricingFromDescription(description)?.replace(/\.$/, "") ||
    undefined;

  const lines: string[] = ["BUSINESS"];
  lines.push(`Business name: ${snapshot.businessName}`);

  if (snapshot.industry?.trim()) {
    lines.push(`Industry: ${snapshot.industry.trim()}`);
  }

  if (description) {
    lines.push("About:");
    lines.push(description);
  }

  if (profile.address?.trim()) {
    lines.push(`Address: ${profile.address.trim()}`);
  }

  if (hours) {
    lines.push("Hours:");
    lines.push(hours);
  }

  if (profile.serviceArea?.trim()) {
    lines.push("Service area:");
    lines.push(profile.serviceArea.trim());
  }

  const services = formatBulletBlock(profile.coreServices);
  if (services) {
    lines.push("Core services:");
    lines.push(services);
  }

  if (pricing) {
    lines.push("Pricing:");
    lines.push(pricing);
    lines.push(
      "Do not provide exact repair prices unless an approved price is listed. Final pricing may depend on inspection.",
    );
  }

  const facts = formatBulletBlock(profile.importantFacts);
  if (facts) {
    lines.push("Important business information:");
    lines.push(facts);
  }

  lines.push(`Timezone: ${snapshot.timezone}`);
  lines.push(`Language: ${snapshot.language}`);

  return lines.join("\n");
}

function buildCallConfigurationSection(snapshot: ReceptionistCompiledSnapshot): string {
  const lines: string[] = ["CALL CONFIGURATION"];

  lines.push(
    `When to answer: ${ANSWER_WHEN_LABELS[snapshot.answerWhen] || snapshot.answerWhen}`,
  );

  lines.push(`Answer questions: ${snapshot.capabilities.includes("answer_questions") ? "yes" : "no"}`);
  lines.push(`Take messages: ${snapshot.capabilities.includes("take_messages") ? "yes" : "no"}`);
  lines.push(`Collect caller information: ${snapshot.capabilities.includes("collect_info") ? "yes" : "no"}`);
  lines.push(`Booking: ${snapshot.capabilities.includes("book_appointments") ? "yes" : "no"}`);
  lines.push(`Transfer: ${snapshot.capabilities.includes("transfer_calls") ? "yes" : "no"}`);
  lines.push(`SMS: ${snapshot.capabilities.includes("send_text") ? "yes" : "no"}`);

  if (snapshot.voiceV2IntakeInstructions) {
    lines.push(snapshot.voiceV2IntakeInstructions);
  } else if (snapshot.fieldManifest.length > 0) {
    lines.push("Required information:");
    for (const field of snapshot.fieldManifest) {
      lines.push(`- ${field.label}${field.required ? " (required)" : ""}`);
    }
  }

  const transfer = snapshot.transferPolicy as {
    destinationE164?: string;
    emergencyDestinationE164?: string;
    whenToTransfer?: string;
    transferInstructions?: string;
  } | undefined;
  if (snapshot.capabilities.includes("transfer_calls")) {
    lines.push("Transfer configuration:");
    if (transfer?.whenToTransfer === "caller_asks") {
      lines.push("- Transfer when the caller asks for a person.");
    } else if (transfer?.whenToTransfer === "certain_calls") {
      lines.push("- Transfer only for certain calls per customer policy.");
      if (transfer.transferInstructions?.trim()) {
        lines.push(`- Policy: ${transfer.transferInstructions.trim()}`);
      }
    }
    if (transfer?.destinationE164) {
      lines.push(`- Destination: ${transfer.destinationE164}`);
    }
    if (transfer?.emergencyDestinationE164) {
      lines.push(`- Emergency destination: ${transfer.emergencyDestinationE164}`);
    }
  }

  const booking = snapshot.bookingPolicy as {
    slotsToOffer?: number;
    minimumNoticeHours?: number;
  } | undefined;
  if (snapshot.capabilities.includes("book_appointments")) {
    lines.push("Booking configuration:");
    if (booking?.minimumNoticeHours) {
      lines.push(`- Minimum notice: ${booking.minimumNoticeHours} hours`);
    }
    if (booking?.slotsToOffer) {
      lines.push(`- Offer up to ${booking.slotsToOffer} slots per request`);
    }
  }

  const knowledge = snapshot.knowledgePolicy as { whenUncertain?: string } | undefined;
  if (knowledge?.whenUncertain === "take_message") {
    lines.push("When uncertain about niche topics: offer to take a message.");
  } else if (knowledge?.whenUncertain === "transfer") {
    lines.push("When uncertain about niche topics: offer transfer.");
  } else if (knowledge?.whenUncertain === "say_unknown") {
    lines.push("When uncertain about niche topics: say you do not have that information.");
  }

  for (const rule of snapshot.decisionRules || []) {
    const condition = String((rule as { condition?: string }).condition || "").trim();
    const action = String((rule as { action?: string }).action || "").trim();
    const target = String((rule as { target?: string }).target || "").trim();
    if (condition && action) {
      lines.push(`Decision rule: IF ${condition} THEN ${action}${target ? ` (${target})` : ""}`);
    }
  }

  return lines.join("\n");
}

/**
 * Static compiled prompt (Layers 1–7 at publish).
 * Runtime call state and tools are outside this string.
 */
export function buildReceptionistCompiledPrompt(snapshot: ReceptionistCompiledSnapshot): string {
  const staticCore = snapshot.voiceV2OneAmy
    ? AMY_V2_CORE_STATIC_PROMPT
    : TRANSOVO_RECEPTIONIST_CONSTITUTION;
  const sections = [
    staticCore,
    "",
    "AGENT",
    personalityFromSnapshot(snapshot),
    "",
    buildBusinessSection(snapshot),
    "",
    buildYourJobSection(snapshot),
  ];

  const additional = buildAdditionalInstructionsSection(snapshot);
  if (additional) {
    sections.push("", additional);
  }

  sections.push(
    "",
    buildCallConfigurationSection(snapshot),
    "",
    buildToolFeedbackVocabularyForPrompt(),
    "",
    buildGeneratedWorkflowRules(snapshot),
  );

  return sections.join("\n");
}
