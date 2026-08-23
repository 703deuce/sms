import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDeterministicExecutiveSummary } from "@/lib/reporting/ai-executive-summary";
import {
  isSectionEnabled,
  resolveReportSections,
} from "@/lib/reporting/report-sections";

describe("buildDeterministicExecutiveSummary", () => {
  it("describes top-3 improvement without inventing strategy advice", () => {
    const text = buildDeterministicExecutiveSummary(
      {
        businessName: "Acme Dental",
        keyword: "dentist near me",
        reportLabel: "Monthly client report",
        kpis: { top3Pct: 42, arp: 4.2 },
        priorKpis: { top3Pct: 30, arp: 5.8 },
      },
      "professional"
    );
    assert.match(text, /improved|increased/i);
    assert.match(text, /42%/);
    assert.doesNotMatch(text, /backlink|category|buy reviews/i);
  });

  it("falls back when metrics are missing", () => {
    const text = buildDeterministicExecutiveSummary({
      businessName: "Acme",
      reportLabel: "Prospect audit",
      kpis: {},
    });
    assert.match(text, /Acme/);
    assert.match(text, /ready/i);
  });

  it("simple tone keeps the summary short", () => {
    const text = buildDeterministicExecutiveSummary(
      {
        businessName: "Acme",
        reportLabel: "Report",
        kpis: { top3Pct: 20, arp: 8 },
        priorKpis: { top3Pct: 10, arp: 10 },
        aiMentioned: 2,
        aiTotal: 5,
      },
      "simple"
    );
    // At most two sentences for simple tone.
    assert.ok(text.split(/(?<=[.!?])\s+/).length <= 3);
  });
});

describe("report sections", () => {
  it("defaults executive summary and maps overview on", () => {
    const sections = resolveReportSections(null);
    assert.equal(sections.executive_summary, true);
    assert.equal(sections.maps_overview, true);
    assert.equal(sections.ai_visibility, false);
  });

  it("respects partial overrides", () => {
    assert.equal(isSectionEnabled({ ai_visibility: true }, "ai_visibility"), true);
    assert.equal(isSectionEnabled({ maps_grid: false }, "maps_grid"), false);
  });
});
