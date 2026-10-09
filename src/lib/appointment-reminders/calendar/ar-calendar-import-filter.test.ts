import { describe, expect, it } from "vitest";
import { isImportedCalendarAppointmentRow } from "./ar-calendar-import-filter";

describe("isImportedCalendarAppointmentRow", () => {
  it("accepts microsoft external ids and rejects manual rows", () => {
    expect(
      isImportedCalendarAppointmentRow({
        externalId: "microsoft:conn1:event-abc",
        metadata: { provider: "microsoft", providerEventId: "event-abc" },
      }),
    ).toBe(true);
    expect(
      isImportedCalendarAppointmentRow({
        externalId: null,
        metadata: {},
      }),
    ).toBe(false);
  });
});
