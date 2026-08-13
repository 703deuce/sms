import type { ReceptionistCompiledSnapshot } from "./types";
import { TRANSOVO_RECEPTIONIST_CONSTITUTION } from "./transovo-receptionist-constitution";
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
  friendly: "Friendly, warm, and approachable",
  professional: "Professional and courteous",
  casual: "Casual and conversational",
};

const LENGTH_LABELS: Record<string, string> = {
  concise: "Keep replies short — one or two sentences unless more detail is needed",
  balanced: "Balanced — clear and conversational without rambling",
  detailed: "May give fuller explanations when helpful, but stay conversational",
};

function personalityFromSnapshot(snapshot: ReceptionistCompiledSnapshot): string {
  const conv = snapshot.conversationBehavior as {
    style?: string;
    responseLength?: string;
    fillerSpeech?: string;
  } | undefined;
  const style = STYLE_LABELS[conv?.style || "professional"] || STYLE_LABELS.professional;
  const length = LENGTH_LABELS[conv?.responseLength || "balanced"] || LENGTH_LABELS.balanced;
  const lines = [
    `Name: ${snapshot.agentDisplayName}`,
    `Role: AI receptionist for ${snapshot.businessName}`,
    `Personality: ${style}.`,
    "Speaking behavior:",
    "- Speak naturally and conversationally.",
    "- Do not sound scripted.",
    `- ${length}.`,
    "- Acknowledge information naturally without repeating it unnecessarily.",
    "- Never claim an action happened unless the corresponding tool succeeded.",
  ];
  if (conv?.fillerSpeech === "minimal") {
    lines.push("- Use minimal filler words.");
  } else if (conv?.fillerSpeech === "off") {
    lines.push("- Avoid filler words and transition phrases.");
  }
  return lines.join("\n");
}

function synthesizeJobInstructions(snapshot: ReceptionistCompiledSnapshot): string {
  const business = snapshot.businessName.trim() || "the business";
  const bullets: string[] = [
    "Answer incoming calls.",
    "Answer basic questions about the business using BUSINESS and these instructions.",
    "Determine why the caller is calling.",
  ];
  if (snapshot.capabilities.includes("collect_info")) {
    const fields = snapshot.fieldManifest.map((f) => f.label).join(", ");
    bullets.push(
      fields
        ? `Collect caller information when needed: ${fields}.`
        : "Collect required caller information when needed.",
    );
  }
  if (snapshot.capabilities.includes("take_messages")) {
    bullets.push("Take messages when the caller cannot be helped immediately.");
  }
  if (snapshot.capabilities.includes("transfer_calls")) {
    bullets.push("Transfer callers when appropriate and after they confirm.");
  }
  if (snapshot.capabilities.includes("book_appointments")) {
    bullets.push("Book appointments when requested and permitted.");
  }
  if (snapshot.capabilities.includes("send_text")) {
    bullets.push("Send SMS only after the caller agrees.");
  }
  return [
    `You are the front-desk receptionist for ${business}.`,
    "",
    "Your primary responsibilities:",
    ...bullets.map((b) => `- ${b}`),
  ].join("\n");
}

function buildYourJobSection(snapshot: ReceptionistCompiledSnapshot): string {
  const job = snapshot.agentJobInstructions?.trim() || synthesizeJobInstructions(snapshot);
  const additional = snapshot.additionalInstructions?.trim();
  const parts = ["YOUR JOB", job];
  if (additional) {
    parts.push("", "Additional instructions from the business owner:", additional);
  }
  return parts.join("\n");
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

  if (snapshot.capabilities.includes("book_appointments")) {
    const booking = snapshot.bookingPolicy as { minimumNoticeHours?: number } | undefined;
    lines.push("Appointments:");
    lines.push("Appointments are available during normal business hours when booking is enabled.");
    if (booking?.minimumNoticeHours) {
      lines.push(`Require at least ${booking.minimumNoticeHours} hours notice when scheduling.`);
    }
    lines.push("Collect required customer information before booking.");
  }

  const facts = formatBulletBlock(profile.importantFacts);
  if (facts) {
    lines.push("Important company facts:");
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

  const fieldLabels =
    snapshot.fieldManifest.length > 0
      ? snapshot.fieldManifest.map((f) => f.label).join(", ")
      : "None configured";
  lines.push(`Information to collect: ${fieldLabels}`);

  lines.push(`Answer questions: ${snapshot.capabilities.includes("answer_questions") ? "yes" : "no"}`);
  lines.push(`Take messages: ${snapshot.capabilities.includes("take_messages") ? "yes" : "no"}`);
  lines.push(`Collect caller info: ${snapshot.capabilities.includes("collect_info") ? "yes" : "no"}`);
  lines.push(`Booking enabled: ${snapshot.capabilities.includes("book_appointments") ? "yes" : "no"}`);
  lines.push(`Transfer enabled: ${snapshot.capabilities.includes("transfer_calls") ? "yes" : "no"}`);
  lines.push(`SMS enabled: ${snapshot.capabilities.includes("send_text") ? "yes" : "no"}`);

  const transfer = snapshot.transferPolicy as {
    destinationE164?: string;
    emergencyDestinationE164?: string;
  } | undefined;
  if (transfer?.destinationE164) {
    lines.push(`Transfer destination: ${transfer.destinationE164}`);
  }
  if (transfer?.emergencyDestinationE164) {
    lines.push(`Emergency transfer: ${transfer.emergencyDestinationE164}`);
  }

  const booking = snapshot.bookingPolicy as {
    slotsToOffer?: number;
    confirmDateTimeVerbally?: boolean;
    offerEarliestAvailability?: boolean;
    askPreferredDayFirst?: boolean;
  } | undefined;
  if (snapshot.capabilities.includes("book_appointments") && booking) {
    if (booking.askPreferredDayFirst) lines.push("Booking: ask preferred day/time before listing slots.");
    if (booking.offerEarliestAvailability) {
      lines.push("Booking: offer earliest availability when caller has no preference.");
    }
    if (booking.confirmDateTimeVerbally) {
      lines.push("Booking: confirm date and time verbally before scheduling.");
    }
    if (booking.slotsToOffer) {
      lines.push(`Booking: offer up to ${booking.slotsToOffer} slot options at a time.`);
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

  const intents = (snapshot.intentRules || [])
    .filter((i) => (i as { enabled?: boolean }).enabled !== false)
    .map((i) => String((i as { label?: string }).label || "").trim())
    .filter(Boolean);
  if (intents.length) {
    lines.push(`Recognize caller intents: ${intents.join(", ")}`);
  }

  const fallback = snapshot.fallbackPolicy as {
    maxMisunderstandAttempts?: number;
    onMisunderstand?: string;
    onBookingFail?: string;
    onTransferFail?: string;
  } | undefined;
  if (fallback?.maxMisunderstandAttempts) {
    const action =
      fallback.onMisunderstand === "take_message"
        ? "take a message"
        : fallback.onMisunderstand === "transfer"
          ? "offer transfer"
          : "rephrase once more";
    lines.push(
      `After ${fallback.maxMisunderstandAttempts} failed attempts to understand: ${action}.`,
    );
  }
  if (fallback?.onBookingFail === "take_message") {
    lines.push("If booking fails: apologize and take a message for follow-up.");
  } else if (fallback?.onBookingFail === "follow_up") {
    lines.push("If booking fails: tell the caller someone will follow up shortly.");
  }
  if (fallback?.onTransferFail === "take_message") {
    lines.push("If transfer fails: take a message instead of ending abruptly.");
  }

  lines.push(
    "",
    "CURRENT CALL STATE is maintained in runtime session data and tool results — use collected fields and tool outcomes; do not assume static prompt text reflects the live call.",
  );

  return lines.join("\n");
}

/**
 * Layers 1–5 of the receptionist prompt (static, compiled at publish).
 * Layer 6 (knowledge retrieval) and layer 7 (tools) are outside this string.
 */
export function buildReceptionistCompiledPrompt(snapshot: ReceptionistCompiledSnapshot): string {
  return [
    TRANSOVO_RECEPTIONIST_CONSTITUTION,
    "",
    "AGENT",
    personalityFromSnapshot(snapshot),
    "",
    buildYourJobSection(snapshot),
    "",
    buildBusinessSection(snapshot),
    "",
    buildCallConfigurationSection(snapshot),
  ].join("\n");
}
