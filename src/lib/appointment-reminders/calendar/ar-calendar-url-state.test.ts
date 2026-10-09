import { describe, expect, it } from "vitest";
import { parseArCalendarView } from "./ar-calendar-url-state";

describe("parseArCalendarView", () => {
  it("defaults to month when view param missing", () => {
    expect(parseArCalendarView(null)).toBe("month");
    expect(parseArCalendarView("")).toBe("month");
  });

  it("honors explicit view modes", () => {
    expect(parseArCalendarView("week")).toBe("week");
    expect(parseArCalendarView("day")).toBe("day");
    expect(parseArCalendarView("agenda")).toBe("agenda");
  });
});
