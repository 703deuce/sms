import { describe, expect, it } from "vitest";
import {
  isArCalendarViewerReadyFromIntegrationRows,
  isArCalendarViewerReadyFromOverview,
} from "./ar-calendar-viewer-ready";

describe("isArCalendarViewerReadyFromOverview", () => {
  it("is ready when microsoft is connected even if another connection failed", () => {
    expect(
      isArCalendarViewerReadyFromOverview({
        calendars: [
          { status: "connected", importCalendarCount: 2 },
          { status: "error", importCalendarCount: 0 },
        ],
      }),
    ).toBe(true);
  });

  it("is ready when oauth is linked without import calendars selected yet", () => {
    expect(
      isArCalendarViewerReadyFromOverview({
        calendars: [{ status: "connected", importCalendarCount: 0 }],
      }),
    ).toBe(true);
  });

  it("is ready for needs_reauth (integrations still show as connected)", () => {
    expect(
      isArCalendarViewerReadyFromOverview({
        calendars: [{ status: "needs_reauth", importCalendarCount: 0 }],
      }),
    ).toBe(true);
  });
});

describe("isArCalendarViewerReadyFromIntegrationRows", () => {
  it("matches integrations API rows", () => {
    expect(
      isArCalendarViewerReadyFromIntegrationRows([
        { provider: "microsoft", status: "connected" },
      ]),
    ).toBe(true);
  });
});
