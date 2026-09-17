import { describe, expect, it } from "vitest";

import { buildLiveDelegationContextItem } from "./live-delegation-context";
import { detectBookingConfirmationViolation } from "./live-booking-authority";
describe("live booking authority", () => {
  it("buildLiveDelegationContextItem omits top-level delegation_id on developer queue items", () => {
    const item = buildLiveDelegationContextItem({ developerText: "ctx", delegationId: "item_abc" });
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
