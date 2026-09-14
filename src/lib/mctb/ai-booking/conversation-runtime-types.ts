export type MctbAiBookingInboundResult =
  | { handled: false }
  | {
      handled: true;
      reply: string;
      action:
        | "ai_booking"
        | "ai_booking_fallback"
        | "ai_booking_clarify"
        | "ai_booking_timezone_conflict";
      /** Set when provider booking was created — LR should leave slot-selection phase. */
      bookingCompleted?: boolean;
    };
