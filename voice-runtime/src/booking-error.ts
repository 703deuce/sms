/** Re-export — shared with gateway and integrations. */
export {
  bookingFailureReason,
  CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS,
  isCalendlyAlreadyCancelledError,
  isCalendlyMissingFieldError,
  isCalendlyRateLimitError,
  isCalendlySlotError,
  missingFieldIdFromBookingError,
} from "@/lib/voice/calendly-error-classification";
