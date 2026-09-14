export type MctbAiBookingInboundResult =
  | { handled: false }
  | {
      handled: true;
      reply: string;
      action: "ai_booking" | "ai_booking_fallback" | "ai_booking_clarify";
    };
