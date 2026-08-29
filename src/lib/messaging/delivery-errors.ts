/**
 * Normalize provider SMS delivery errors into customer-facing categories.
 * Raw provider codes are preserved separately for support/debugging.
 */

export type FailureCategory =
  | "invalid_number"
  | "landline_unsupported"
  | "carrier_rejected"
  | "blocked_unreachable"
  | "content_rejected"
  | "unknown";

export type NormalizedDeliveryError = {
  category: FailureCategory;
  title: string;
  explanation: string;
};

const CATEGORY_COPY: Record<FailureCategory, { title: string; explanation: string }> = {
  invalid_number: {
    title: "Invalid destination number",
    explanation: "This number could not receive SMS.",
  },
  landline_unsupported: {
    title: "Landline or unsupported number",
    explanation: "This destination cannot receive text messages.",
  },
  carrier_rejected: {
    title: "Carrier rejected",
    explanation: "The recipient's carrier rejected this message.",
  },
  blocked_unreachable: {
    title: "Blocked or unreachable",
    explanation: "The recipient may have blocked messages or is unreachable.",
  },
  content_rejected: {
    title: "Message rejected",
    explanation: "The carrier rejected this message content or sender.",
  },
  unknown: {
    title: "Delivery failed",
    explanation: "The message could not be delivered.",
  },
};

/** Twilio error codes — https://www.twilio.com/docs/api/errors */
const TWILIO_INVALID = new Set(["21211", "21614", "21612", "30005", "30006"]);
const TWILIO_LANDLINE = new Set(["21614", "30006"]);
const TWILIO_CARRIER = new Set(["30003", "30004", "30007", "30008"]);
const TWILIO_BLOCKED = new Set(["30004", "21610"]);
const TWILIO_CONTENT = new Set(["30007", "30008", "21617"]);

function classifyFromText(detail: string | null | undefined): FailureCategory | null {
  const text = (detail || "").toLowerCase();
  if (!text) return null;
  if (text.includes("landline") || text.includes("cannot receive sms") || text.includes("not mobile")) {
    return "landline_unsupported";
  }
  if (text.includes("invalid") && (text.includes("number") || text.includes("to"))) {
    return "invalid_number";
  }
  if (text.includes("blocked") || text.includes("unsubscribed") || text.includes("opted out")) {
    return "blocked_unreachable";
  }
  if (text.includes("carrier") || text.includes("rejected")) {
    return "carrier_rejected";
  }
  return null;
}

export function normalizeDeliveryError(input: {
  provider?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
}): NormalizedDeliveryError {
  const code = (input.errorCode || "").trim();
  const fromText = classifyFromText(input.errorDetail);

  if (input.provider === "twilio" || !input.provider) {
    if (code && TWILIO_LANDLINE.has(code)) {
      return { category: "landline_unsupported", ...CATEGORY_COPY.landline_unsupported };
    }
    if (code && TWILIO_INVALID.has(code)) {
      return { category: "invalid_number", ...CATEGORY_COPY.invalid_number };
    }
    if (code && TWILIO_BLOCKED.has(code)) {
      return { category: "blocked_unreachable", ...CATEGORY_COPY.blocked_unreachable };
    }
    if (code && TWILIO_CONTENT.has(code)) {
      return { category: "content_rejected", ...CATEGORY_COPY.content_rejected };
    }
    if (code && TWILIO_CARRIER.has(code)) {
      return { category: "carrier_rejected", ...CATEGORY_COPY.carrier_rejected };
    }
  }

  // Telnyx codes are often 40xxx — use text heuristics first
  if (fromText) {
    return { category: fromText, ...CATEGORY_COPY[fromText] };
  }

  if (code.startsWith("400") || code === "40001") {
    return { category: "invalid_number", ...CATEGORY_COPY.invalid_number };
  }

  return { category: "unknown", ...CATEGORY_COPY.unknown };
}

export function failureCategoryLabel(category: FailureCategory): string {
  switch (category) {
    case "invalid_number":
      return "Invalid destination";
    case "landline_unsupported":
      return "Landline / unsupported";
    case "carrier_rejected":
      return "Carrier rejected";
    case "blocked_unreachable":
      return "Blocked / unreachable";
    case "content_rejected":
      return "Content rejected";
    default:
      return "Unknown provider error";
  }
}
