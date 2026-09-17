import { describe, expect, it } from "vitest";

import { buildLiveDelegationDeveloperContextItem } from "./live-outbound-events";
import { detectBookingConfirmationViolation } from "./live-booking-authority";
describe("live booking authority", () => {
  it("buildLiveDelegationDeveloperContextItem omits top-level delegation_id", () => {
    const item = buildLiveDelegationDeveloperContextItem({ developerText: "ctx" });
    expect(item.delegation_id).toBeUndefined();
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

});
