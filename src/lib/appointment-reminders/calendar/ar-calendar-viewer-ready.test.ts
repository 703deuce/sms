import { describe, expect, it } from "vitest";
import { isArCalendarViewerReadyFromOverview } from "./ar-calendar-viewer-ready";

describe("isArCalendarViewerReadyFromOverview", () => {
  it("is ready when one connection imports calendars even if another is broken", () => {
    expect(
      isArCalendarViewerReadyFromOverview({
        setup: { calendarConnected: false },
        calendars: [
          { status: "connected", importCalendarCount: 2 },
          { status: "error", importCalendarCount: 0 },
        ],
      }),
    ).toBe(true);
  });

  it("is not ready without import calendars selected", () => {
    expect(
      isArCalendarViewerReadyFromOverview({
        calendars: [{ status: "connected", importCalendarCount: 0 }],
      }),
    ).toBe(false);
  });
});
