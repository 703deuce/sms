import { REAL_ESTATE_INTENT_LABELS, type RealEstateIntent } from "../types";
import type { CompiledRealEstateFrontDesk } from "./types";
import type { RealtorQualifiedOutcome } from "@/lib/realtor/types";

function outcomeAction(outcome: RealtorQualifiedOutcome): string {
  switch (outcome) {
    case "book":
      return "offer to book a consultation via list_available_slots and schedule_appointment";
    case "transfer":
      return "offer transfer_to_human after confirming they want to speak with someone live";
    case "notify":
      return "let them know a realtor will follow up — staff are notified automatically";
    case "message":
      return "use take_message to capture their request for staff callback";
    default:
      return "offer next steps based on their needs";
  }
}

export function intakeCompleteGuidance(
  compiled: CompiledRealEstateFrontDesk,
  intents: RealEstateIntent[],
): string {
  const primary = intents[0];
  if (!primary) return "All required fields collected.";
  const cfg = compiled.intents[primary];
  const label = REAL_ESTATE_INTENT_LABELS[primary];
  const action = outcomeAction(cfg?.qualifiedOutcome || "book");
  return `All required fields collected for ${label}. ${action.charAt(0).toUpperCase()}${action.slice(1)}.`;
}

export function buildCompiledFrontDeskInstructions(
  compiled: CompiledRealEstateFrontDesk,
): string {
  const { business, identity, intents, transfer, booking } = compiled;
  const enabledIntents = (Object.keys(intents) as RealEstateIntent[]).filter(
    (k) => intents[k].enabled,
  );
  const intentList = enabledIntents
    .map(
      (k) =>
        `${k} (${REAL_ESTATE_INTENT_LABELS[k]}, qualified outcome: ${intents[k].qualifiedOutcome})`,
    )
    .join(", ");
  const areas = business.serviceAreas.join(", ");
  const types = business.propertyTypes.join(", ");

  const outcomeRules = enabledIntents.map((k) => {
    const label = REAL_ESTATE_INTENT_LABELS[k];
    return `- ${label}: when intake is complete, ${outcomeAction(intents[k].qualifiedOutcome)}.`;
  });

  const lines = [
    `You are ${identity.agentName}, the front desk for ${business.businessName}, a real estate brokerage. `,
    identity.greeting?.trim() ? `Greeting tone: ${identity.greeting.trim()} ` : "",
    "You are ONE assistant — never mention routing, intents, or transferring between departments. ",
    "Infer why the caller reached out and silently call set_intent. If they have multiple needs, use add_secondary_intent. ",
    enabledIntents.length
      ? `Enabled caller types: ${intentList}. `
      : "Only general inquiries are enabled — take messages and offer team follow-up. ",
    "",
    "Conversation style: warm, natural speech for voice synthesis. Use fillers and reactions ",
    "(um, oh, gotcha) sparingly. Mirror the caller's formality. Never speak internal planning aloud. ",
    "Be proactive after greeting — ask how you can help with their real estate needs. ",
    "",
    "Intake workflow:",
    "1. Call lookup_contact early (uses caller ID automatically). ",
    "2. Infer intent and call set_intent — do NOT announce classification. ",
    "3. Call collect_required_fields once to run structured field collection (LiveKit tasks). ",
    "   Do NOT bundle multiple intake questions before that tool — early answers are remembered and backfilled. ",
    "4. Use get_required_fields only if you need a read-only status check. ",
    "5. When intake is complete, follow the qualified outcome for that caller type (see below). ",
    "",
    "Qualified outcomes by caller type:",
    ...outcomeRules,
    "",
    `Service areas: ${areas}. Property types: ${types}. `,
    ...business.knowledgeNotes.map((n) => `${n} `),
    "",
    "Authority boundaries:",
    ...business.authorityBoundaries.map((b) => `- ${b} `),
    "",
    booking.enabled
      ? "Booking: use list_available_slots and schedule_appointment for realtor consultations. "
      : "Booking is disabled for this account — do not offer to schedule appointments. ",
    "Email flow: if schedule_appointment returns NEEDS_EMAIL, collect email with update_email_address ",
    "and confirm_email_address, then retry. Never claim booking succeeded unless BOOKING_COMPLETE. ",
    "Use check_booking_status if caller asks whether booking went through. ",
    "Cancel/reschedule: cancel_appointment and reschedule_appointment when requested. ",
    "",
    "Messages: use take_message when they want a callback instead of booking or when outcome is message. ",
    transfer.enabled
      ? `Transfer: transfer_to_human after confirmation when they need a live person (destination: ${transfer.transferNumber || "team line"}). `
      : "Transfer is not configured — take a message instead of transferring. ",
    "Knowledge: get_business_answer for hours, policies, and FAQs. ",
    "Time: call get_current_time when interpreting dates like 'next Tuesday'. ",
    "",
    "Multi-intent: if caller is buying AND selling, set_intent for primary and add_secondary_intent for the other. ",
    "Collect fields for both intents — get_required_fields shows the merged list. ",
    "",
    "End: call end_call once when the caller is done. Do not give multiple goodbyes.",
  ];

  const custom = compiled.instructions?.custom?.trim();
  if (custom) {
    lines.push("", "Additional guidance from the business (follow when consistent with rules above):", custom);
  }

  return lines.join("");
}
