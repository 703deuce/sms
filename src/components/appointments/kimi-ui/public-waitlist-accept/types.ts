export type WaitlistAcceptStatus = "loading" | "success" | "error";

export type WaitlistErrorKind = "unavailable" | "network";

export interface WaitlistAcceptResult {
  status: WaitlistAcceptStatus;
  title: string;
  message: string;
  errorKind?: WaitlistErrorKind;
}

export interface AcceptedAppointment {
  businessName: string;
  serviceName: string;
  dateLabel: string;
  timeLabel: string;
  timezoneLabel: string;
  staffName?: string;
}

export const ACCEPTED_APPOINTMENT: AcceptedAppointment = {
  businessName: "Bright Dental Studio",
  serviceName: "New Patient Consultation",
  dateLabel: "Thursday, September 10, 2026",
  timeLabel: "2:00 PM – 2:30 PM",
  timezoneLabel: "Eastern Time",
  staffName: "Dr. Alvarez",
};

export const WAITLIST_ACCEPT_COPY = {
  loading: {
    title: "Confirming your slot",
    message:
      "We're confirming your appointment with the business. This only takes a moment — please don't close this page.",
  },
  success: {
    title: "You're booked!",
    message:
      "Your appointment is confirmed. You'll receive a confirmation message shortly with the date, time, and details.",
  },
  error: {
    title: "Offer unavailable",
    message:
      "This waitlist offer is no longer available. The slot may have already been taken, or the offer may have expired.",
  },
  network: {
    title: "Something went wrong",
    message:
      "We couldn't confirm your slot because of a connection problem. Your offer may still be available — please try again.",
  },
} as const;

export const ERROR_HINTS = [
  "The slot may have been claimed by someone else.",
  "Waitlist offers expire after a limited time.",
  "Contact the business directly to join the waitlist again.",
] as const;

export function simulateAcceptOutcome(token: string): Promise<WaitlistAcceptResult> {
  // Sandbox simulation of POST /api/public/waitlist/accept/[token]
  // Token keywords drive the preview state:
  //   "expired" / "invalid" → offer unavailable
  //   "network"             → connection failure (retryable)
  return new Promise((resolve) => {
    const t = token.toLowerCase();
    const isUnavailable = t.includes("expired") || t.includes("invalid");
    const isNetwork = t.includes("network");
    setTimeout(() => {
      if (isNetwork) {
        resolve({
          status: "error",
          errorKind: "network",
          title: WAITLIST_ACCEPT_COPY.network.title,
          message: WAITLIST_ACCEPT_COPY.network.message,
        });
      } else if (isUnavailable) {
        resolve({
          status: "error",
          errorKind: "unavailable",
          title: WAITLIST_ACCEPT_COPY.error.title,
          message: WAITLIST_ACCEPT_COPY.error.message,
        });
      } else {
        resolve({
          status: "success",
          title: WAITLIST_ACCEPT_COPY.success.title,
          message: WAITLIST_ACCEPT_COPY.success.message,
        });
      }
    }, 1600);
  });
}
