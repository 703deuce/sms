import { describe, expect, it } from "vitest";
import { deriveCallListOutcomeDisplay } from "./outcome-display";

describe("deriveCallListOutcomeDisplay", () => {
  it("does not treat SEND_LINK as booked", () => {
    const r = deriveCallListOutcomeDisplay({
      outcome: "booking_link_sent",
      appointmentBooked: true,
    });
    expect(r.primary).toBe("Booking Link Sent");
  });

  it("does not treat REQUEST_ONLY as booked", () => {
    const r = deriveCallListOutcomeDisplay({
      outcome: "appointment_requested",
      appointmentBooked: true,
    });
    expect(r.primary).toBe("Appointment Requested");
  });

  it("prefers transfer failure over transferred flag", () => {
    const r = deriveCallListOutcomeDisplay({
      outcome: "transfer_failed",
      transferred: true,
    });
    expect(r.primary).toBe("Transfer Failed");
  });

  it("surfaces solicitor outcome", () => {
    const r = deriveCallListOutcomeDisplay({ outcome: "solicitor_blocked" });
    expect(r.primary).toBe("Solicitor");
  });
});
