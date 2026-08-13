import type { ReceptionistCompiledSnapshot } from "./types";
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

function line(label: string, value: string | undefined | null): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return `- ${label}: ${trimmed}`;
}

function compactBlock(lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

/**
 * Deterministic BUSINESS CONTEXT block for prompt injection at publish time.
 * Core facts a receptionist should always know — not retrieved via tools.
 */
export function buildReceptionistBusinessContext(snapshot: ReceptionistCompiledSnapshot): string {
  const description = snapshot.businessDescription.trim();
  const hours = extractHoursFromDescription(description);
  const pricing = extractPricingFromDescription(description);
  const servicesLine = description.split(/[.!?]/)[0]?.trim();

  const capabilityLines = snapshot.capabilities.map((c) => c.replace(/_/g, " ")).join(", ");

  const booking = snapshot.bookingPolicy as {
    minimumNoticeHours?: number;
    slotsToOffer?: number;
    confirmDateTimeVerbally?: boolean;
    offerEarliestAvailability?: boolean;
  } | undefined;

  const transfer = snapshot.transferPolicy as {
    destinationE164?: string;
    emergencyDestinationE164?: string;
    warmTransfer?: boolean;
  } | undefined;

  const knowledge = snapshot.knowledgePolicy as {
    approvedKnowledgeOnly?: boolean;
    whenUncertain?: string;
  } | undefined;

  const fieldLabels =
    snapshot.fieldManifest.length > 0
      ? snapshot.fieldManifest.map((f) => f.label).join(", ")
      : null;

  const coreFacts = compactBlock([
    line("Business name", snapshot.businessName),
    line("Agent name", snapshot.agentDisplayName),
    description ? `- About: ${description}` : null,
    hours ? line("Hours", hours) : null,
    line("Timezone", snapshot.timezone),
    line("Language", snapshot.language),
    servicesLine && servicesLine !== description ? line("Services summary", servicesLine) : null,
    pricing ? line("Pricing / fees", pricing.replace(/\.$/, "")) : null,
    line("Call coverage", ANSWER_WHEN_LABELS[snapshot.answerWhen] || snapshot.answerWhen),
    capabilityLines ? `- Capabilities: ${capabilityLines}` : null,
    fieldLabels ? `- Caller info to collect when needed: ${fieldLabels}` : null,
    booking?.minimumNoticeHours
      ? line("Booking notice", `At least ${booking.minimumNoticeHours} hours advance`)
      : null,
    booking?.slotsToOffer ? line("Slots to offer", `Up to ${booking.slotsToOffer} options`) : null,
    transfer?.destinationE164
      ? line("Transfer destination", transfer.destinationE164)
      : null,
    transfer?.emergencyDestinationE164
      ? line("Emergency transfer", transfer.emergencyDestinationE164)
      : null,
    knowledge?.whenUncertain === "take_message"
      ? "- When unsure about niche topics: offer to take a message"
      : knowledge?.whenUncertain === "transfer"
        ? "- When unsure about niche topics: offer transfer"
        : knowledge?.whenUncertain === "say_unknown"
          ? "- When unsure about niche topics: say you do not have that information"
          : null,
  ]);

  return [
    "BUSINESS CONTEXT (authoritative — answer from here; do not call tools for these facts):",
    coreFacts,
    "",
    "Use get_business_answer only for long-tail material: uploaded documents, website pages, large FAQ libraries, detailed policies, manuals, or niche product documentation not covered above.",
  ].join("\n");
}

export const RECEPTIONIST_BUSINESS_CONTEXT_HEADER = "BUSINESS CONTEXT";
