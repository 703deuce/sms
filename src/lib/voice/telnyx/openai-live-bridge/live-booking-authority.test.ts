import { describe, expect, it } from "vitest";

import { buildLiveDelegationContextItem } from "./live-delegation-context";
import { detectBookingConfirmationViolation } from "./live-booking-authority";
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

});
