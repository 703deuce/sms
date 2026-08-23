import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  MIN_MAP_IMAGE_BYTES,
  REPORT_ARTIFACT_KINDS,
  SINGLE_SCAN_PDF_EXPECTED_PAGES,
  SINGLE_SCAN_PDF_TEMPLATE_VERSION,
  artifactContentType,
  artifactFileExtension,
  type CompetitorLimit,
  type ReportArtifactKind,
} from "@/lib/reporting/pdf/constants";
import { gridPointSpacingMeters, zoomForRadiusMeters } from "@/lib/reporting/pdf/mercator";
import { renderHeatmapGridPng } from "@/lib/reporting/pdf/render-heatmap-image";
import { renderScanMapPng } from "@/lib/reporting/pdf/render-map-image";
import {
  countPdfPages,
  renderSingleScanPdfDetailed,
} from "@/lib/reporting/pdf/render-single-scan-pdf";
import { singleScanPointsCsv, singleScanSummaryCsv } from "@/lib/reporting/scan-csv";
import type { SingleScanReportPayload } from "@/lib/reporting/types";

function brandingVersionFromWhiteLabel(wl: { companyName?: string }): string {
  return wl.companyName ?? "";
}

function artifactIdentityKey(params: {
  kind: ReportArtifactKind;
  scanBatchId: string;
  competitorLimit?: CompetitorLimit;
  brandingVersion: string;
  dataVersion: string;
}): string {
  const limit = params.competitorLimit ?? 20;
  return [
    params.kind,
    "single_scan",
    params.scanBatchId,
    SINGLE_SCAN_PDF_TEMPLATE_VERSION,
    `comp:${limit}`,
    `brand:${params.brandingVersion.slice(0, 64)}`,
    `data:${params.dataVersion}`,
  ].join(":");
}

function samplePayload(gridSize: number, competitorCount = 5): SingleScanReportPayload {
  const cells = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const rank = (row + col) % 21 || null;
      cells.push({
        label: `${String.fromCharCode(65 + (row % 26))}${col + 1}`,
        row,
        col,
        rank: rank === 0 ? null : rank,
        color: "#0B7A29",
        textColor: "#ffffff",
      });
    }
  }

  const competitors = [
    {
      key: "you",
      name: "Test Business With A Longer Name LLC",
      address: "13327 Kirkdale Ct, Woodbridge, VA 22193",
      arp: 4.5,
      atrp: 5.2,
      solv: 26,
      top3Appearances: 13,
      totalCells: gridSize * gridSize,
      appearancePct: 100,
      rating: 4.8,
      reviewCount: 120,
      isTarget: true,
    },
    ...Array.from({ length: competitorCount }, (_, i) => ({
      key: `c${i}`,
      name: `Competitor Business Number ${i + 1} Services`,
      address: `${1000 + i} Example Avenue Suite ${i + 10}, Springfield, VA 22150`,
      arp: 5 + i * 0.3,
      atrp: 6 + i * 0.3,
      solv: Math.max(1, 40 - i * 2),
      top3Appearances: Math.max(0, 10 - i),
      totalCells: gridSize * gridSize,
      appearancePct: Math.max(10, 90 - i * 5),
      rating: 4.2,
      reviewCount: 50 + i * 3,
      isTarget: false,
    })),
  ];

  return {
    reportType: "single_scan",
    business: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Test Business With A Longer Name LLC",
      address: "13327 Kirkdale Ct, Woodbridge, VA 22193",
      category: "Junk removal service",
      rating: 4.8,
      reviewCount: 120,
      placeId: null,
      mapsUrl: null,
    },
    parameters: {
      keyword: "junk removal",
      scannedAt: new Date().toISOString(),
      gridSize,
      radiusMeters: 8047,
      pointCount: gridSize * gridSize,
      platform: "maps",
      centerLabel: "Woodbridge",
      scanId: "00000000-0000-0000-0000-000000000099",
    },
    kpis: {
      arp: 4.5,
      atrp: 5.2,
      solv: 26,
      top3Pct: 26,
      top10Pct: 100,
      notFoundPct: 0,
      visibilityScore: 100,
      bestRank: 1,
      worstRank: 12,
      totalCells: gridSize * gridSize,
      foundCells: gridSize * gridSize,
    },
    heatmap: { gridSize, cells },
    competitors,
    rankDistribution: [
      { label: "1-3", count: 13 },
      { label: "4-10", count: 36 },
      { label: "11-20", count: 0 },
      { label: "20+/Not found", count: 0 },
    ],
    whiteLabel: { companyName: "Maps Growth Agent", accentColor: "#059669" },
    generatedAt: new Date().toISOString(),
  };
}

async function syntheticMapPng(width = 1280, height = 1280): Promise<Buffer> {
  // Large enough to pass MIN_MAP_IMAGE_BYTES when used as a stand-in in unit tests.
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 220, b: 240 },
    },
  })
    .png()
    .toBuffer();
}

/** PDFKit encodes Helvetica text as hex TJ chunks — decode for assertions. */
function pdfDecodedText(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const parts: string[] = [];
  for (const match of latin.matchAll(/<([0-9A-Fa-f]+)>/g)) {
    const hex = match[1];
    if (hex.length % 2 !== 0) continue;
    let out = "";
    for (let i = 0; i < hex.length; i += 2) {
      out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    }
    parts.push(out);
  }
  return parts.join("");
}

describe("scan PDF artifacts", () => {
  it("exposes all download kinds with content types", () => {
    assert.deepEqual([...REPORT_ARTIFACT_KINDS], [
      "pdf",
      "map_png",
      "heatmap_png",
      "summary_csv",
      "points_csv",
    ]);
    assert.equal(artifactContentType("pdf"), "application/pdf");
    assert.equal(artifactFileExtension("map_png"), "png");
    assert.equal(SINGLE_SCAN_PDF_TEMPLATE_VERSION, "single-scan-pdf-v3");
    assert.equal(SINGLE_SCAN_PDF_EXPECTED_PAGES, 4);
    assert.ok(MIN_MAP_IMAGE_BYTES >= 1000);
  });

  it("builds stable artifact identity keys", () => {
    const a = artifactIdentityKey({
      kind: "pdf",
      scanBatchId: "scan-1",
      competitorLimit: 20,
      brandingVersion: brandingVersionFromWhiteLabel({ companyName: "Acme" }),
      dataVersion: "2026-01-01",
    });
    const b = artifactIdentityKey({
      kind: "pdf",
      scanBatchId: "scan-1",
      competitorLimit: 20,
      brandingVersion: brandingVersionFromWhiteLabel({ companyName: "Acme" }),
      dataVersion: "2026-01-01",
    });
    assert.equal(a, b);
    assert.match(a, /pdf:single_scan:scan-1/);
    assert.match(a, /single-scan-pdf-v3/);
  });

  it("computes pin spacing and zoom for common grids", () => {
    assert.equal(gridPointSpacingMeters(7, 8047), (2 * 8047) / 6);
    assert.ok(zoomForRadiusMeters(8047, 1280) >= 10);
    assert.ok(zoomForRadiusMeters(8047, 1280) <= 18);
  });

  it("splits summary vs points CSV", () => {
    const payload = samplePayload(3);
    const summary = singleScanSummaryCsv(payload);
    const points = singleScanPointsCsv(payload);
    assert.match(summary, /arp/);
    assert.match(summary, /competitor/);
    assert.doesNotMatch(summary, /^label,row,col,rank/m);
    assert.match(points, /label,row,col,rank/);
    assert.equal(points.split("\n").filter((l) => l.includes(",0,")).length >= 1, true);
  });

  it("renders heatmap PNG for 3×3, 7×7, and 9×9", async () => {
    for (const size of [3, 7, 9]) {
      const buf = await renderHeatmapGridPng({
        gridSize: size,
        cells: samplePayload(size).heatmap.cells,
        cellPx: size >= 9 ? 28 : 40,
      });
      assert.ok(buf.byteLength > 500, `${size}x${size} png too small`);
      assert.equal(buf[0], 0x89); // PNG magic
    }
  });

  it("renders exactly 4 PDF pages for common grid sizes and competitor counts", async () => {
    const mapPng = await syntheticMapPng();
    assert.ok(mapPng.byteLength > MIN_MAP_IMAGE_BYTES);

    for (const gridSize of [3, 5, 7, 9, 15]) {
      for (const competitorCount of [5, 20, 100]) {
        const payload = samplePayload(gridSize, competitorCount);
        const heatmapPng = await renderHeatmapGridPng({
          gridSize,
          cells: payload.heatmap.cells,
          cellPx: gridSize >= 9 ? 24 : 36,
        });
        const result = await renderSingleScanPdfDetailed({
          payload,
          mapPng,
          heatmapPng,
          reportId: "00000000-0000-0000-0000-0000000000aa",
          competitorLimit: competitorCount <= 10 ? 10 : competitorCount <= 20 ? 20 : "all",
          centerLat: 38.658,
          centerLng: -77.25,
        });
        assert.equal(
          result.pdfPagesExpected,
          SINGLE_SCAN_PDF_EXPECTED_PAGES,
          `${gridSize}x${gridSize} / ${competitorCount} competitors`
        );
        assert.equal(
          result.pdfPagesActual,
          SINGLE_SCAN_PDF_EXPECTED_PAGES,
          `${gridSize}x${gridSize} / ${competitorCount} competitors got ${result.pdfPagesActual}`
        );
        assert.equal(countPdfPages(result.buffer), SINGLE_SCAN_PDF_EXPECTED_PAGES);
        assert.ok(result.buffer.byteLength > 5_000);
        const decoded = pdfDecodedText(result.buffer);
        assert.doesNotMatch(decoded, /★|✓|✔|📍|🔥/);
        assert.match(decoded, /\[YOU\]/);
        assert.match(decoded, /Map data \(c\) Google/);
        assert.match(decoded, /Page 1 of 4/);
        assert.match(decoded, /Page 4 of 4/);
      }
    }
  });

  const MAP_KEY_ENVS = [
    "GOOGLE_MAPS_STATIC_API_KEY",
    "STATIC_MAPS_API_KEY",
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    "NEXT_PUBLIC_MAPS",
    "MAPS",
    "GOOGLE_MAPS_API_KEY",
    "GOOGLE_MAPS_KEY",
  ] as const;

  function withClearedMapsKeys<T>(fn: () => Promise<T>): Promise<T> {
    const prev = Object.fromEntries(MAP_KEY_ENVS.map((k) => [k, process.env[k]]));
    for (const k of MAP_KEY_ENVS) delete process.env[k];
    return fn().finally(() => {
      for (const k of MAP_KEY_ENVS) {
        if (prev[k] != null) process.env[k] = prev[k];
        else delete process.env[k];
      }
    });
  }

  it("fails clearly when requireRealMap is set and no API key is available", async () => {
    await withClearedMapsKeys(async () => {
      await assert.rejects(
        () =>
          renderScanMapPng({
            centerLat: 38.65,
            centerLng: -77.25,
            radiusMeters: 8000,
            gridSize: 7,
            pins: [{ lat: 38.65, lng: -77.25, rank: 1 }],
            requireRealMap: true,
          }),
        /Static Maps key is not configured|require a real map/i
      );
    });
  });

  it("falls back to blank map when requireRealMap is false and key is missing", async () => {
    await withClearedMapsKeys(async () => {
      const result = await renderScanMapPng({
        centerLat: 38.65,
        centerLng: -77.25,
        radiusMeters: 8000,
        gridSize: 3,
        pins: [{ lat: 38.65, lng: -77.25, rank: 2 }],
        requireRealMap: false,
        width: 320,
        height: 320,
      });
      assert.equal(result.mapSource, "blank_fallback");
      assert.equal(result.buffer[0], 0x89);
      assert.equal(result.width, 320);
      assert.equal(result.height, 320);
    });
  });
});
