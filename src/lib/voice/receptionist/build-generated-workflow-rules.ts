import type { ReceptionistCompiledSnapshot } from "./types";

/**
 * Transovo-generated operational workflow rules from structured customer configuration.
 * Customers do not write these manually — the compiler produces them from capabilities + policies.
 */
export function buildGeneratedWorkflowRules(snapshot: ReceptionistCompiledSnapshot): string {
  const lines: string[] = ["GENERATED WORKFLOW RULES"];

  if (snapshot.capabilities.includes("collect_info") && snapshot.fieldManifest.length > 0) {
    const required = snapshot.fieldManifest.filter((f) => f.required).map((f) => f.label);
    const optional = snapshot.fieldManifest.filter((f) => !f.required).map((f) => f.label);
    lines.push("Information collection:");
    if (required.length) {
      lines.push(`- Required fields: ${required.join(", ")}.`);
    }
    if (optional.length) {
      lines.push(`- Optional fields when relevant: ${optional.join(", ")}.`);
    }
    lines.push(
      "- Collect missing required fields before completing the caller's request when collection is enabled.",
      "- Use collect_caller_fields only for service or booking — never for a simple callback message.",
      "- Use runtime collected-field state and tools — do not re-ask for values already captured.",
    );
  }

  if (snapshot.capabilities.includes("take_messages")) {
    lines.push("Taking messages:");
    lines.push(
      "- When the caller wants a callback or to leave a message, use take_message — not collect_caller_fields.",
      "- If they already described the issue, put that in reason. Do not ask again.",
      "- Use caller ID for callback when appropriate; only ask for name or number if still unknown.",
      "- Do not explain internal steps or narrate what you will collect.",
      "- After take_message succeeds, confirm follow-up once. Do not ask to leave another message.",
    );
    const notifications = snapshot.notifications as {
      messageEmail?: string;
      messageSms?: string;
    } | undefined;
    if (notifications?.messageEmail) {
      lines.push(`- Deliver messages to email: ${notifications.messageEmail}.`);
    }
    if (notifications?.messageSms) {
      lines.push(`- Deliver messages to SMS: ${notifications.messageSms}.`);
    }
  }

  if (snapshot.capabilities.includes("book_appointments")) {
    const booking = snapshot.bookingPolicy as {
      askPreferredDayFirst?: boolean;
      offerEarliestAvailability?: boolean;
      confirmDateTimeVerbally?: boolean;
      slotsToOffer?: number;
      minimumNoticeHours?: number;
    } | undefined;
    lines.push("Booking appointments:");
    lines.push("- Check live calendar availability before offering times.");
    lines.push("- Never offer or confirm slots that were not returned by availability tools.");
    if (booking?.askPreferredDayFirst) {
      lines.push("- Ask for the caller's preferred day or time before listing options.");
    }
    if (booking?.offerEarliestAvailability) {
      lines.push("- Offer earliest available times when the caller has no preference.");
    }
    if (booking?.confirmDateTimeVerbally) {
      lines.push("- Confirm date and time verbally before schedule_appointment.");
    }
    if (booking?.slotsToOffer) {
      lines.push(`- Offer up to ${booking.slotsToOffer} slot options at a time.`);
    }
    if (booking?.minimumNoticeHours) {
      lines.push(`- Do not book within ${booking.minimumNoticeHours} hours of the current time.`);
    }
    lines.push("- Collect all required booking fields before scheduling.");
    lines.push(
      "- For email during booking, use record_receptionist_field (field_id email) — do not also call record_booking_email.",
      "- After schedule_appointment succeeds, answer outcome questions from booking state — do not call check_booking_status unless the write may still be in progress.",
      "- Do not call schedule_appointment repeatedly while a calendar write is already running.",
    );
    const fallback = snapshot.fallbackPolicy as { onBookingFail?: string } | undefined;
    if (fallback?.onBookingFail === "take_message") {
      lines.push("- If booking fails: apologize and take a message for follow-up.");
    } else if (fallback?.onBookingFail === "follow_up") {
      lines.push("- If booking fails: tell the caller someone will follow up shortly.");
    }
  }

  if (snapshot.capabilities.includes("transfer_calls")) {
    const transfer = snapshot.transferPolicy as {
      destinationE164?: string;
      emergencyDestinationE164?: string;
      whenToTransfer?: string;
      transferInstructions?: string;
    } | undefined;
    lines.push("Call transfers:");
    if (transfer?.whenToTransfer === "caller_asks") {
      lines.push("- Transfer when the caller asks to speak with a person.");
    } else if (transfer?.whenToTransfer === "certain_calls") {
      lines.push("- Transfer only for calls matching the customer's transfer policy.");
      if (transfer.transferInstructions?.trim()) {
        lines.push(`- Transfer policy: ${transfer.transferInstructions.trim()}`);
      }
    } else {
      lines.push("- Follow the customer's transfer policy and YOUR JOB instructions.");
    }
    if (transfer?.destinationE164) {
      lines.push(`- Primary transfer destination: ${transfer.destinationE164}.`);
    }
    if (transfer?.emergencyDestinationE164) {
      lines.push(`- Emergency transfer destination: ${transfer.emergencyDestinationE164}.`);
    }
    lines.push("- Confirm the caller wants a transfer before initiating when appropriate.");
    const fallback = snapshot.fallbackPolicy as { onTransferFail?: string } | undefined;
    if (fallback?.onTransferFail === "take_message") {
      lines.push("- If transfer fails: take a message instead of ending abruptly.");
    }
  }

  if (snapshot.capabilities.includes("send_text")) {
    lines.push("Text messages:");
    lines.push(
      "- After a successful booking, a confirmation text is sent automatically.",
      "- When the caller asks for a text, use send_sms — never say you cannot send texts from here.",
      "- If a confirmation text was already sent, tell them to check their phone or use send_sms again.",
      "- Confirm SMS success via tool results before telling the caller a text was sent.",
    );
  }

  if (snapshot.capabilities.includes("answer_questions")) {
    lines.push("Answering questions:");
    lines.push(
      "- Answer ordinary business questions from BUSINESS and CUSTOMER INSTRUCTIONS without retrieval.",
      "- Use get_business_answer only for long-tail reference material not in the compiled prompt.",
    );
  }

  const fallback = snapshot.fallbackPolicy as {
    maxMisunderstandAttempts?: number;
    onMisunderstand?: string;
  } | undefined;
  if (fallback?.maxMisunderstandAttempts) {
    const action =
      fallback.onMisunderstand === "take_message"
        ? "take a message"
        : fallback.onMisunderstand === "transfer"
          ? "offer transfer"
          : "rephrase once more";
    lines.push(
      `After ${fallback.maxMisunderstandAttempts} failed attempts to understand the caller: ${action}.`,
    );
  }

  return lines.join("\n");
}
