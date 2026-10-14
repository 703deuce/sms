import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countPdfPages } from "@/lib/reporting/pdf/render-single-scan-pdf";
import { renderRollupPdf } from "@/lib/reporting/pdf/render-rollup-pdf";
import type { MapsCampaignReportPayload } from "@/lib/reporting/types";

describe("renderRollupPdf", () => {
  it("produces a multi-page PDF for maps campaign reports", async () => {
    const payload: MapsCampaignReportPayload = {
      reportType: "maps_campaign",
      business: { id: "b1", name: "Acme Dental", address: "1 Main St" },
      parameters: {
        campaignId: "c1",
        campaignName: "Core keywords",
        scheduleEnabled: true,
        cronExpression: "weekly",
        nextRunAt: null,
        lastRunAt: null,
        gridSize: 7,
        radiusMeters: 8000,
        keywordCount: 2,
        dateFrom: "2026-06-01T00:00:00.000Z",
        dateTo: "2026-06-30T00:00:00.000Z",
        baselineScanBatchId: "base-1",
        comparisonMode: "baseline",
      },
      aggregate: {
        arp: 6.2,
        atrp: 10.1,
        solv: 28,
        top3Pct: 28,
        top10Pct: 0,
        notFoundPct: 0,
        visibilityScore: 0,
        bestRank: null,
        worstRank: null,
        totalCells: 2,
        foundCells: 2,
      },
      keywords: [
        {
          keyword: "dentist",
          keywordId: "k1",
          scanId: "s2",
          scannedAt: "2026-06-28T00:00:00.000Z",
          priorScanId: "base-1",
          arp: 5,
          atrp: 9,
          solv: 35,
          changeArp: 2.5,
        },
        {
          keyword: "teeth cleaning",
          keywordId: "k2",
          scanId: "s3",
          scannedAt: "2026-06-27T00:00:00.000Z",
          arp: 7.4,
          atrp: 11,
          solv: 21,
          changeArp: -0.4,
        },
      ],
      rising: ["dentist"],
      falling: ["teeth cleaning"],
      whiteLabel: { companyName: "Freelance SEO Co", accentColor: "#059669" },
      generatedAt: "2026-07-01T00:00:00.000Z",
      executiveSummary: "Solid gains on the primary keyword vs baseline.",
      periodLabel: "June 2026",
    };

    const buf = await renderRollupPdf(payload);
    assert.ok(buf.byteLength > 800, `PDF too small: ${buf.byteLength}`);
    assert.equal(buf.subarray(0, 4).toString("utf8"), "%PDF");
    const pages = countPdfPages(buf);
    assert.ok(pages >= 2, `expected >=2 pages, got ${pages}`);
  });
});
