import { describe, expect, it } from "vitest";

import {
  buildLiveDelegationContextItem,
} from "./live-delegation-context";
import {
  detectBookingConfirmationViolation,
} from "./live-booking-authority";
import {
  buildAuthoritativeBackendStatePayload,
  createLiveBookingSessionState,
  shouldShortCircuitRedundantFind,
} from "./live-booking-session-state";

describe("live booking authority", () => {
  it("buildLiveDelegationContextItem omits delegation_id", () => {
    const item = buildLiveDelegationContextItem({ developerText: "ctx" });
    expect(item).not.toHaveProperty("delegation_id");
    expect(item.type).toBe("response.item.create");
  });

  it("detects premature booking confirmation language", () => {
    expect(
      detectBookingConfirmationViolation("You're all set for 9 a.m. Thursday.", false),
    ).toBe(true);
    expect(
      detectBookingConfirmationViolation("You're all set for 9 a.m. Thursday.", true),
    ).toBe(false);
  });

  it("exposes booking_status NOT_BOOKED until confirmed", () => {
    const state = createLiveBookingSessionState();
    expect(buildAuthoritativeBackendStatePayload(state).booking_status).toBe(
      "NOT_BOOKED",
    );
    state.bookingConfirmed = true;
    expect(buildAuthoritativeBackendStatePayload(state).booking_status).toBe(
      "BOOKING_CONFIRMED",
    );
  });

  it("short-circuits redundant FIND for same offer window", () => {
    const state = createLiveBookingSessionState();
    state.currentOfferSet = {
      offer_set_id: "v2offer_x",
      slots: [{ slot_id: "slot_1", spoken_label: "9:00 AM" }],
      requested_date: "2026-09-24",
      time_window: { start: "06:00", end: "12:00" },
    };
    expect(
      shouldShortCircuitRedundantFind(
        {
          requested_date: "2026-09-24",
          time_window: { start: "06:00", end: "12:00" },
        },
        state,
      ),
    ).toBe(true);
    expect(
      shouldShortCircuitRedundantFind(
        { requested_date: "2026-09-25", time_window: { start: "06:00", end: "12:00" } },
        state,
      ),
    ).toBe(false);
  });
});
