import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderReportHtml } from "@/lib/reporting/render-html";
import type { TrendReportPayload } from "@/lib/reporting/types";

function sampleTrend(overrides: Partial<TrendReportPayload> = {}): TrendReportPayload {
  return {
    reportType: "trend",
    business: { id: "b1", name: "Acme Dental" },
    parameters: {
      keyword: "dentist near me",
      gridSize: 7,
      radiusMeters: 8000,
      locationId: null,
      dateFrom: "2026-06-01T00:00:00.000Z",
      dateTo: "2026-06-30T00:00:00.000Z",
      scanCount: 2,
    },
    series: [
      {
        scanId: "s1",
        date: "2026-06-01T00:00:00.000Z",
        arp: 8,
        atrp: 12,
        solv: 20,
        top3Pct: 20,
        top10Pct: 40,
        visibilityScore: 40,
      },
      {
        scanId: "s2",
        date: "2026-06-28T00:00:00.000Z",
        arp: 5,
        atrp: 9,
        solv: 35,
        top3Pct: 35,
        top10Pct: 55,
        visibilityScore: 55,
      },
    ],
    current: { arp: 5, atrp: 9, solv: 35 },
    previous: { arp: 8, atrp: 12, solv: 20 },
    deltas: { arp: 3, atrp: 3, solv: 15 },
    whiteLabel: { companyName: "Freelance SEO Co", accentColor: "#059669" },
    generatedAt: "2026-07-01T00:00:00.000Z",
    periodLabel: "June 2026",
    sections: {
      cover: true,
      executive_summary: true,
      maps_overview: true,
      comparison: true,
      trend: true,
      ai_visibility: true,
      footer: true,
    },
    executiveSummary: "Ranks improved this month.",
    aiVisibility: {
      hasData: true,
      runAt: "2026-06-25T00:00:00.000Z",
      previousRunAt: "2026-05-25T00:00:00.000Z",
      visibilityScore: 42,
      previousVisibilityScore: 30,
      targetMentioned: true,
      previousTargetMentioned: false,
      promptsChecked: 2,
      enginesChecked: 3,
      engines: [
        { engine: "chatgpt", mentioned: true, status: "complete" },
        { engine: "gemini", mentioned: false, status: "complete" },
      ],
      prompts: [{ text: "best dentist in town", mentioned: true }],
      competitors: [{ name: "Rival Dental", mentions: 2 }],
      summary: "Mentioned on ChatGPT this month.",
      methodology: "Plain methodology.",
    },
    comparison: {
      mode: "prior_period",
      baselineLabel: "Prior",
      currentLabel: "Current",
      baselineScanId: "s1",
      currentScanId: "s2",
      keyword: "dentist near me",
      baselineHeatmap: {
        gridSize: 2,
        cells: [
          { label: "A1", row: 0, col: 0, rank: 8, color: "#fbbf24", textColor: "#111" },
          { label: "A2", row: 0, col: 1, rank: null, color: "#e5e5e5", textColor: "#111" },
        ],
      },
      currentHeatmap: {
        gridSize: 2,
        cells: [
          { label: "A1", row: 0, col: 0, rank: 3, color: "#22c55e", textColor: "#111" },
          { label: "A2", row: 0, col: 1, rank: 5, color: "#84cc16", textColor: "#111" },
        ],
      },
      kpiDelta: { arp: 3, atrp: 3, solv: 15 },
    },
    ...overrides,
  };
}

describe("report HTML polish", () => {
  it("renders cover, comparison, and real AI visibility data", () => {
    const html = renderReportHtml(sampleTrend());
    assert.match(html, /Freelance SEO Co/);
    assert.match(html, /Monthly client report/);
    assert.match(html, /cover-brand/);
    assert.match(html, /Before-and-after comparison/);
    assert.match(html, /AI visibility/);
    assert.match(html, /chatgpt/i);
    assert.match(html, /best dentist in town/);
    assert.match(html, /Mentioned on ChatGPT/);
    assert.doesNotMatch(html, /leave this section off when it is not/i);
  });

  it("omits AI block when section disabled", () => {
    const html = renderReportHtml(
      sampleTrend({
        sections: { ...sampleTrend().sections, ai_visibility: false },
      })
    );
    assert.doesNotMatch(html, /<h2>AI visibility<\/h2>/);
  });
});
