import { describe, expect, it } from "vitest";
import {
  localDateKeyInTimezone,
  normalizeVoiceAnalyticsDays,
  voiceAnalyticsPeriodBounds,
} from "./voice-analytics-period";

describe("normalizeVoiceAnalyticsDays", () => {
  it("normalizes invalid to 30", () => {
    expect(normalizeVoiceAnalyticsDays(14)).toBe(30);
    expect(normalizeVoiceAnalyticsDays(7)).toBe(7);
  });
});

describe("localDateKeyInTimezone", () => {
  it("groups UTC late evening into US Pacific previous calendar day", () => {
    const instant = new Date("2026-03-10T06:30:00.000Z");
    expect(localDateKeyInTimezone(instant, "America/Los_Angeles")).toBe("2026-03-09");
  });
});

describe("voiceAnalyticsPeriodBounds", () => {
  it("returns consecutive day keys for 7-day window", () => {
    const now = new Date("2026-03-10T15:00:00.000Z");
    const { dayKeys } = voiceAnalyticsPeriodBounds(7, "America/New_York", now);
    expect(dayKeys).toHaveLength(7);
    expect(dayKeys[dayKeys.length - 1]).toBe(localDateKeyInTimezone(now, "America/New_York"));
  });
});
