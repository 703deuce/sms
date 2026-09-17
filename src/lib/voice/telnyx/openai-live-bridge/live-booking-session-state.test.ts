import { describe, expect, it } from "vitest";

import {
  applyFindResultToSessionState,
  createLiveBookingSessionState,
  mergeFindArgsWithSessionState,
} from "./live-booking-session-state";

describe("live-booking-session-state", () => {
  it("fills missing requested_date from session preference", () => {
    const state = createLiveBookingSessionState();
    state.schedulingPreference.requested_date = "2026-09-25";
    state.schedulingPreference.time_window = { start: "08:00", end: "12:00" };
    const { merged, mergeNotes } = mergeFindArgsWithSessionState(
      { time_window: { start: "08:00", end: "12:00" } },
      state,
    );
    expect(merged.requested_date).toBe("2026-09-25");
    expect(mergeNotes).toContain("filled_requested_date_from_session");
  });

  it("stores offer set after successful FIND", () => {
    const state = createLiveBookingSessionState();
    applyFindResultToSessionState(state, {
      voice_v2_status: "AVAILABILITY_FOUND",
      offer_set_id: "v2offer_test",
      slots: [
        { slot_id: "slot_a", label: "10 AM" },
        { slot_id: "slot_b", label: "11 AM" },
      ],
    });
    expect(state.currentOfferSet?.offer_set_id).toBe("v2offer_test");
    expect(state.currentOfferSet?.slots).toHaveLength(2);
  });
});
