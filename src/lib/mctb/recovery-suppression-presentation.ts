/**
 * Customer-facing recovery / suppression explanations for Missed Calls surfaces.
 * Runtime reason codes → title + explanation + presentation category.
 */

export type RecoveryPresentationCategory =
  | "success"
  | "in_progress"
  | "suppressed"
  | "failed"
  | "unknown";

export type RecoverySuppressionPresentation = {
  category: RecoveryPresentationCategory;
  title: string;
  explanation: string;
  /** Short label for list secondary line — never raw enum. */
  shortLabel: string;
  unknown: boolean;
};

function normalizeCode(raw: string | null | undefined): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "_");
}

const EXACT: Record<
  string,
  Omit<RecoverySuppressionPresentation, "unknown"> & { unknown?: boolean }
> = {
  NOT_EXISTING_CONSENT: {
    category: "suppressed",
    title: "No Press-1",
    shortLabel: "No Press-1",
    explanation:
      "The caller did not press 1 to agree to receive a text, so no recovery message was sent.",
  },
  OPTED_OUT: {
    category: "suppressed",
    title: "Previously opted out",
    shortLabel: "Opted out",
    explanation: "This caller previously opted out of text messages.",
  },
  RECOVERY_PAUSED: {
    category: "suppressed",
    title: "Recovery paused",
    shortLabel: "Recovery paused",
    explanation: "Missed-call recovery was paused when this call occurred.",
  },
  MCTB_DISABLED: {
    category: "suppressed",
    title: "Recovery paused",
    shortLabel: "Recovery paused",
    explanation: "Missed-call recovery was paused when this call occurred.",
  },
  COOLDOWN_ACTIVE: {
    category: "suppressed",
    title: "Cooldown",
    shortLabel: "Recently texted",
    explanation:
      "This caller was recently sent a recovery message, so another message was not sent.",
  },
  COOLDOWN: {
    category: "suppressed",
    title: "Cooldown",
    shortLabel: "Recently texted",
    explanation:
      "This caller was recently sent a recovery message, so another message was not sent.",
  },
  BLOCKED_NUMBER: {
    category: "suppressed",
    title: "Exclusion rule",
    shortLabel: "Excluded",
    explanation: "This caller matched one of your recovery exclusions.",
  },
  TRIGGER_DISABLED: {
    category: "suppressed",
    title: "Not eligible",
    shortLabel: "Not a missed call",
    explanation:
      "This call was not eligible for missed-call recovery because it was answered or was not classified as a missed call.",
  },
  NOT_FORWARD_EVENT: {
    category: "suppressed",
    title: "Not forwarded",
    shortLabel: "Not forwarded",
    explanation: "The call did not reach Transovo through your configured forwarding.",
  },
  MESSAGING_NOT_READY: {
    category: "failed",
    title: "Messaging setup",
    shortLabel: "Messaging not ready",
    explanation: "Messaging was not ready when this call occurred, so no recovery text was sent.",
  },
  MESSAGING_NOT_APPROVED: {
    category: "failed",
    title: "Messaging setup",
    shortLabel: "Sender not ready",
    explanation: "Messaging was not ready when this call occurred, so no recovery text was sent.",
  },
  MESSAGING_BLOCKED: {
    category: "failed",
    title: "Messaging blocked",
    shortLabel: "Messaging blocked",
    explanation: "Messaging was not permitted when this call occurred.",
  },
  SENDER_UNAVAILABLE: {
    category: "failed",
    title: "Sender unavailable",
    shortLabel: "Sender unavailable",
    explanation: "The text-back sender was not available to send a recovery message.",
  },
  PROVIDER_REJECTED: {
    category: "failed",
    title: "Cannot receive SMS",
    shortLabel: "Delivery blocked",
    explanation: "This phone number could not receive the recovery text.",
  },
  INVALID_PHONE: {
    category: "failed",
    title: "Cannot receive SMS",
    shortLabel: "Invalid number",
    explanation: "This phone number could not receive the recovery text.",
  },
  WORKSPACE_INACTIVE: {
    category: "suppressed",
    title: "Service inactive",
    shortLabel: "Service inactive",
    explanation: "Recovery was not active for your account when this call occurred.",
  },
};

function matchPartial(code: string): RecoverySuppressionPresentation | null {
  if (code.includes("COOLDOWN")) {
    return presentRecoverySuppression("COOLDOWN_ACTIVE", "SUPPRESSED");
  }
  if (code.includes("OPT") && code.includes("OUT")) {
    return presentRecoverySuppression("OPTED_OUT", "SUPPRESSED");
  }
  if (code.includes("MESSAGING") && (code.includes("NOT") || code.includes("APPROV"))) {
    return presentRecoverySuppression("MESSAGING_NOT_READY", "SUPPRESSED");
  }
  if (code.includes("EXCLUS") || code.includes("BLOCKED")) {
    return presentRecoverySuppression("BLOCKED_NUMBER", "SUPPRESSED");
  }
  return null;
}

export function presentRecoverySuppression(
  suppressionReason: string | null | undefined,
  status: string,
): RecoverySuppressionPresentation {
  const s = status.toUpperCase();
  const code = normalizeCode(suppressionReason);

  if (s === "FAILED" && !code) {
    return {
      category: "failed",
      title: "Delivery failed",
      shortLabel: "Failed",
      explanation: "The recovery text could not be delivered.",
      unknown: false,
    };
  }

  if (code && EXACT[code]) {
    const row = EXACT[code];
    return { ...row, unknown: false };
  }

  const partial = code ? matchPartial(code) : null;
  if (partial) return partial;

  if (s === "SUPPRESSED" && code) {
    return {
      category: "suppressed",
      title: "Recovery text not sent",
      shortLabel: "Not texted",
      explanation: "A policy rule prevented sending a recovery message for this call.",
      unknown: false,
    };
  }

  if (s === "SUPPRESSED") {
    return {
      category: "suppressed",
      title: "Suppressed",
      shortLabel: "Suppressed",
      explanation: "No recovery message was sent for this call.",
      unknown: false,
    };
  }

  return {
    category: "unknown",
    title: "Reason unavailable",
    shortLabel: "Unknown",
    explanation: "We couldn't determine why a recovery message wasn't sent.",
    unknown: true,
  };
}

export function shouldShowWhyNotTexted(status: string, smsSentAt: Date | string | null): boolean {
  const s = status.toUpperCase();
  if (smsSentAt) return false;
  return s === "SUPPRESSED" || s === "FAILED" || s === "WAITING_CONSENT" || s === "PENDING_CONSENT";
}
