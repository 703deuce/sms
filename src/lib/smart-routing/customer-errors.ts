/** Map provider / internal errors to customer-facing Smart Routing messages. */
export function toSmartRoutingCustomerError(raw: string): string {
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  if (lower.includes("verified_number_not_allowed") || lower.includes("422")) {
    return "We couldn't verify this number. Make sure it can receive a verification call or text and try again.";
  }
  if (lower.includes("invalid phone") || lower.includes("phone_number")) {
    return "Enter a valid phone number in international format (e.g. +1 703 555 1000).";
  }
  if (lower.includes("verification code") || lower.includes("code required")) {
    return "Enter the verification code we sent to your business number.";
  }
  if (lower.includes("code rejected") || lower.includes("invalid code")) {
    return "That code didn't work. Check the message and try again, or request a new code.";
  }
  if (lower.includes("pin") && lower.includes("digit")) {
    return "PIN must be 4–6 numeric digits.";
  }
  if (lower.includes("locked") || lower.includes("lockout")) {
    return "Too many incorrect PIN attempts. Try again later or reset the PIN.";
  }
  if (lower.includes("not found")) {
    return "We couldn't find that item. Refresh the page and try again.";
  }
  if (lower.includes("telnyx") || lower.includes("provider")) {
    return "Something went wrong on our end. Please try again in a moment.";
  }

  return msg.length > 120 ? "Something went wrong. Please try again." : msg;
}
