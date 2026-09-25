import { describe, expect, it } from "vitest";
import { deriveCallListOutcomeDisplay } from "./calls/outcome-display";

describe("Overview recent call outcome parity with Calls", () => {
  it("uses shared classifier for booked call with failed transfer leg", () => {
    const row = deriveCallListOutcomeDisplay({
      appointmentBooked: true,
      outcome: "appointment_booked",
      transfers: [{ status: "failed", answered: false }],
    });
    expect(row.primary).toBe("Transfer Failed");
  });

  it("surfaces transfer failed as attention when primary is booked without failed transfer primary", () => {
    const row = deriveCallListOutcomeDisplay({
      appointmentBooked: true,
      outcome: "appointment_booked",
      transferred: true,
      transfers: [{ status: "completed", answered: false }],
    });
    expect(row.primary).toBe("Appointment Booked");
  });
});
