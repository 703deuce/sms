import { describe, expect, it } from "vitest";
import {
  applyDerivedHoursKnowledgeItem,
  brainHoursSummaryFromKnowledgeItems,
} from "./knowledge-editor-hours-sync-pure";

const weekdaySchedule = {
  timezone: "America/New_York",
  weekly: {
    monday: { closed: false, ranges: [{ start: "08:00", end: "17:00" }] },
    tuesday: { closed: false, ranges: [{ start: "08:00", end: "17:00" }] },
    wednesday: { closed: false, ranges: [{ start: "08:00", end: "17:00" }] },
    thursday: { closed: false, ranges: [{ start: "08:00", end: "17:00" }] },
    friday: { closed: false, ranges: [{ start: "08:00", end: "17:00" }] },
    saturday: { closed: true, ranges: [] },
    sunday: { closed: true, ranges: [] },
  },
  holidays: [],
};

describe("applyDerivedHoursKnowledgeItem", () => {
  it("derives hours item from structured schedule and preserves other knowledge items", () => {
    const items = [
      {
        id: "pricing",
        label: "Pricing",
        summary: "Starting at $99",
        status: "complete" as const,
        statusLabel: "Saved",
      },
      {
        id: "hours",
        label: "Hours",
        summary: "STALE MANUAL PROSE — WRONG",
        status: "complete" as const,
        statusLabel: "Old",
      },
    ];

    const next = applyDerivedHoursKnowledgeItem(items, weekdaySchedule);
    const hours = next.find((k) => k.id === "hours");
    const pricing = next.find((k) => k.id === "pricing");

    expect(pricing?.summary).toBe("Starting at $99");
    expect(hours?.status).toBe("complete");
    expect(hours?.summary).not.toContain("STALE MANUAL PROSE");
    expect(hours?.summary?.toLowerCase()).toMatch(/monday|8|08:00|17:00/);

    const brainHours = brainHoursSummaryFromKnowledgeItems(next);
    expect(brainHours).toBe(hours?.summary);
    expect(brainHours).toBeTruthy();
  });

});
