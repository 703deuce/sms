import type { AppointmentReceptionistWizardState } from "./types";
import {
  normalizeWizardTransferPhone,
  wizardTransferDestinationName,
} from "./transfer-utils";

/** UI copy for the activation step — safe for client components. */
export function buildReceptionistWillList(state: AppointmentReceptionistWizardState): string[] {
  const phone = state.phoneNumberE164 || "your assigned number";
  const items = [
    `Answer incoming calls on ${phone}`,
    `Greet the caller as ${state.agentName || "Astra"}${state.businessName ? ` from ${state.businessName}` : ""}`,
  ];
  if (state.capabilities.includes("answer_questions")) {
    items.push("Answer questions using your business knowledge base");
  }
  if (state.bookingBehavior.askServiceFirst) {
    items.push("Ask what service the caller needs");
  }
  const fields = state.collectFields
    .filter((f) => f.enabled && f.required)
    .map((f) => f.label.toLowerCase());
  if (fields.length) {
    items.push(`Collect ${fields.join(", ")}`);
  }
  items.push("Save caller details with save_caller_info");
  if (state.capabilities.includes("book_appointments")) {
    items.push("Check your calendar for availability");
    items.push(
      state.bookingBehavior.offerEarliestThree
        ? "Offer the earliest three matching appointments"
        : "Offer two or three matching appointments",
    );
    if (state.bookingBehavior.confirmBeforeBooking) {
      items.push("Confirm the caller's selection before booking");
    }
    items.push("Book the appointment");
  }
  if (state.bookingBehavior.sendSmsAfterBooking) {
    items.push("Send an SMS confirmation");
  }
  if (
    state.capabilities.includes("transfer_calls") &&
    normalizeWizardTransferPhone(state.transferDestinationPhone)
  ) {
    const name = wizardTransferDestinationName(state.transferDestinationName);
    items.push(`Transfer urgent or frustrated callers to ${name}`);
    items.push(`Take a message if ${name} does not answer`);
  }
  return items;
}
