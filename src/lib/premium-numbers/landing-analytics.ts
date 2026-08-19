export type NumbersLandingEvent =
  | "landing_view"
  | "geo_market_detected"
  | "top_pick_impression"
  | "top_pick_clicked"
  | "manual_search_started"
  | "ai_search_started"
  | "search_completed"
  | "number_detail_viewed"
  | "number_reserve_clicked"
  | "reservation_created"
  | "checkout_started"
  | "purchase_completed"
  | "port_out_started";

export function trackNumbersLandingEvent(
  event: NumbersLandingEvent,
  props?: Record<string, string | number | boolean | null | undefined>,
) {
  console.info(
    JSON.stringify({
      scope: "numbers_landing",
      event,
      ts: new Date().toISOString(),
      ...props,
    }),
  );
}
