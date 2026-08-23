import PDFDocument from "pdfkit";
import sharp from "sharp";
import {
  SINGLE_SCAN_PDF_EXPECTED_PAGES,
  type CompetitorLimit,
} from "@/lib/reporting/pdf/constants";
import { gridPointSpacingMeters } from "@/lib/reporting/pdf/mercator";
import type { ReportCompetitorRow, SingleScanReportPayload } from "@/lib/reporting/types";

/** Count /Type /Page objects in a PDF buffer (excludes /Pages). */
export function countPdfPages(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

const PAGE_MARGINS = { top: 40, bottom: 0, left: 36, right: 36 } as const;
const FOOTER_Y_OFFSET = 32;

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits);
}

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "-";
  return `${Math.round(n)}%`;
}

function selectCompetitors(
  rows: ReportCompetitorRow[],
  limit: CompetitorLimit
): ReportCompetitorRow[] {
  const target = rows.find((r) => r.isTarget);
  const others = rows
    .filter((r) => !r.isTarget)
    .slice()
    .sort((a, b) => (b.solv ?? 0) - (a.solv ?? 0) || (a.arp ?? 99) - (b.arp ?? 99));
  const capped =
    limit === "all" ? others : others.slice(0, typeof limit === "number" ? limit : 20);
  return target ? [target, ...capped] : capped;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  payload: SingleScanReportPayload,
  pageLabel: string
) {
  const accent = payload.whiteLabel.accentColor || "#059669";
  const company = payload.whiteLabel.companyName || "Local SEO Express";
  doc.save();
  doc.rect(0, 0, doc.page.width, 28).fill(accent);
  doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
  doc.text(company, 36, 9, { width: doc.page.width - 200, lineBreak: false });
  doc.font("Helvetica").fontSize(8);
  doc.text(pageLabel, 36, 9, {
    align: "right",
    width: doc.page.width - 72,
    lineBreak: false,
  });
  doc.restore();
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  payload: SingleScanReportPayload,
  reportId: string,
  pageNum: number,
  pageCount: number
) {
  const y = doc.page.height - FOOTER_Y_OFFSET;
  doc.save();
  doc
    .moveTo(36, y - 6)
    .lineTo(doc.page.width - 36, y - 6)
    .strokeColor("#e4e4e7")
    .lineWidth(0.5)
    .stroke();
  doc.fillColor("#71717a").fontSize(7).font("Helvetica");
  const left = payload.whiteLabel.companyName?.trim()
    ? `${payload.whiteLabel.companyName} · ${payload.business.name}`
    : payload.business.name;
  const generated = new Date(payload.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  doc.text(`${left} · ${reportId.slice(0, 8)} · ${generated}`, 36, y, {
    width: doc.page.width - 140,
    lineBreak: false,
    ellipsis: true,
  });
  doc.text(`Page ${pageNum} of ${pageCount}`, 36, y, {
    align: "right",
    width: doc.page.width - 72,
    lineBreak: false,
  });
  doc.restore();
}

function kpiBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string
) {
  doc.save();
  doc.roundedRect(x, y, w, h, 5).fillAndStroke("#fafafa", "#e4e4e7");
  doc.fillColor("#71717a").fontSize(9).font("Helvetica").text(label, x + 10, y + 10, {
    width: w - 20,
    lineBreak: false,
  });
  doc.fillColor("#18181b").fontSize(18).font("Helvetica-Bold").text(value, x + 10, y + 28, {
    width: w - 20,
    lineBreak: false,
  });
  doc.restore();
}

export type RenderSingleScanPdfResult = {
  buffer: Buffer;
  pdfPagesExpected: number;
  pdfPagesActual: number;
};

/**
 * Dedicated print template for single-scan PDF exports.
 * Exactly 4 physical pages (overview, map, performance, competitors landscape).
 */
export async function renderSingleScanPdf(params: {
  payload: SingleScanReportPayload;
  mapPng: Buffer;
  heatmapPng?: Buffer | null;
  reportId: string;
  competitorLimit?: CompetitorLimit;
  centerLat: number;
  centerLng: number;
}): Promise<Buffer> {
  const result = await renderSingleScanPdfDetailed(params);
  return result.buffer;
}

export async function renderSingleScanPdfDetailed(params: {
  payload: SingleScanReportPayload;
  mapPng: Buffer;
  heatmapPng?: Buffer | null;
  reportId: string;
  competitorLimit?: CompetitorLimit;
  centerLat: number;
  centerLng: number;
}): Promise<RenderSingleScanPdfResult> {
  const payload = params.payload;
  const competitorLimit = params.competitorLimit ?? 20;
  const competitors = selectCompetitors(payload.competitors, competitorLimit);
  const spacing = Math.round(
    gridPointSpacingMeters(payload.parameters.gridSize, payload.parameters.radiusMeters)
  );
  const pageCount = SINGLE_SCAN_PDF_EXPECTED_PAGES;
  const contentTop = PAGE_MARGINS.top;
  const footerReserve = 44;

  // bottom: 0 — PDFKit must never auto-insert pages when footer/chrome draws near the edge.
  const doc = new PDFDocument({
    size: "LETTER",
    layout: "portrait",
    margins: { ...PAGE_MARGINS },
    autoFirstPage: true,
    bufferPages: true,
    // Keep content streams readable for page-count / attribution verification.
    compress: false,
    info: {
      Title: `Local Rank Scan Report - ${payload.business.name}`,
      Author: payload.whiteLabel.companyName || "Local SEO Express",
      Subject: payload.parameters.keyword,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const k = payload.kpis;
  let pageNum = 1;

  // ── Page 1: Overview ─────────────────────────────────────────────
  drawHeader(doc, payload, "Overview");
  doc.y = contentTop + 10;
  doc.fillColor("#18181b").fontSize(20).font("Helvetica-Bold").text("Local Rank Scan Report", 36, doc.y, {
    width: doc.page.width - 72,
    lineBreak: false,
  });
  doc.y += 26;
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#18181b").text(payload.business.name, {
    width: doc.page.width - 72,
  });
  if (payload.business.address) {
    doc.fontSize(10).font("Helvetica").fillColor("#52525b").text(payload.business.address, {
      width: doc.page.width - 72,
    });
  }
  doc.moveDown(0.55);

  const metaLeft = [
    ["Keyword", payload.parameters.keyword],
    ["Provider", "Google Maps"],
    ["Scan date", new Date(payload.parameters.scannedAt).toLocaleString("en-US")],
    ["Grid", `${payload.parameters.gridSize}x${payload.parameters.gridSize}`],
  ] as const;
  const metaRight = [
    ["Radius", `${Math.round(payload.parameters.radiusMeters)} m`],
    ["Pin spacing", `${spacing} m`],
    ["Center", `${params.centerLat.toFixed(5)}, ${params.centerLng.toFixed(5)}`],
    ["Scan ID", payload.parameters.scanId.slice(0, 8)],
  ] as const;

  const metaY = doc.y;
  doc.fontSize(10).fillColor("#3f3f46");
  metaLeft.forEach((row, i) => {
    const y = metaY + i * 17;
    doc.font("Helvetica-Bold").text(`${row[0]}: `, 36, y, { continued: true, lineBreak: false });
    doc.font("Helvetica").text(String(row[1]).slice(0, 48), { lineBreak: false });
  });
  metaRight.forEach((row, i) => {
    const y = metaY + i * 17;
    doc.font("Helvetica-Bold").text(`${row[0]}: `, 318, y, { continued: true, lineBreak: false });
    doc.font("Helvetica").text(String(row[1]).slice(0, 48), { lineBreak: false });
  });
  doc.y = metaY + metaLeft.length * 17 + 18;

  const boxes: Array<[string, string]> = [
    ["Avg. rank", fmt(k.arp)],
    ["Avg. rank (all cells)", fmt(k.atrp)],
    ["Top 3 %", pct(k.solv)],
    ["Top 3", pct(k.top3Pct)],
    ["Top 10", pct(k.top10Pct)],
    ["Visibility", pct(k.visibilityScore)],
    ["Best rank", k.bestRank != null ? String(k.bestRank) : "-"],
    ["Worst rank", k.worstRank != null ? String(k.worstRank) : "-"],
  ];
  const boxW = (doc.page.width - 72 - 30) / 4;
  const boxH = 64;
  const gap = 10;
  let bx = 36;
  let by = doc.y;
  boxes.forEach((b, i) => {
    if (i > 0 && i % 4 === 0) {
      bx = 36;
      by += boxH + gap;
    }
    kpiBox(doc, bx, by, boxW, boxH, b[0], b[1]);
    bx += boxW + gap;
  });
  doc.y = by + boxH + 22;

  doc.fillColor("#18181b").fontSize(12).font("Helvetica-Bold").text("Coverage snapshot", 36, doc.y);
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(11).fillColor("#3f3f46");
  const top3Cells = Math.round((k.top3Pct / 100) * k.totalCells);
  const top10Cells = Math.round((k.top10Pct / 100) * k.totalCells);
  const notFoundCells = Math.round((k.notFoundPct / 100) * k.totalCells);
  doc.text(
    `Found in ${k.foundCells} of ${k.totalCells} cells. Top 3: ${top3Cells} · Top 10: ${top10Cells} · Not found: ${notFoundCells}.`
  );
  doc.moveDown(0.75);

  doc.fillColor("#18181b").fontSize(12).font("Helvetica-Bold").text("Rank distribution");
  doc.moveDown(0.45);
  const maxBucket = Math.max(1, ...payload.rankDistribution.map((d) => d.count));
  let barY = doc.y;
  for (const bucket of payload.rankDistribution) {
    const barW = ((doc.page.width - 200) * bucket.count) / maxBucket;
    doc.font("Helvetica").fontSize(10).fillColor("#3f3f46");
    doc.text(bucket.label, 36, barY, { width: 90, lineBreak: false });
    doc.roundedRect(136, barY, Math.max(4, barW), 14, 3).fill("#059669");
    doc.fillColor("#18181b").text(String(bucket.count), 146 + barW, barY + 1, { lineBreak: false });
    barY += 22;
  }
  doc.y = barY + 8;

  drawFooter(doc, payload, params.reportId, pageNum, pageCount);

  // ── Page 2: Rank grid map ────────────────────────────────────────
  doc.addPage({ size: "LETTER", layout: "portrait", margins: { ...PAGE_MARGINS } });
  pageNum = 2;
  drawHeader(doc, payload, "Rank grid map");
  // Compact chrome so the map can use ~80% of page height.
  doc.y = contentTop + 4;
  doc.fillColor("#18181b").fontSize(12).font("Helvetica-Bold").text("Rank-grid map", 36, doc.y, {
    lineBreak: false,
  });
  doc.y += 15;
  doc.fontSize(8).font("Helvetica").fillColor("#52525b");
  doc.text(
    `${payload.parameters.gridSize}x${payload.parameters.gridSize} grid · ${Math.round(payload.parameters.radiusMeters)} m radius · ~${spacing} m pin spacing · Map data (c) Google`,
    { width: doc.page.width - 72, lineBreak: false }
  );
  doc.y += 10;

  const mapTop = doc.y;
  const mapMaxW = doc.page.width - 72;
  const mapMaxH = doc.page.height - mapTop - footerReserve - 6;
  const mapMeta = await sharp(params.mapPng).metadata();
  const srcW = mapMeta.width || mapMaxW;
  const srcH = mapMeta.height || mapMaxH;
  const aspect = srcW / Math.max(1, srcH);
  let drawW = mapMaxW;
  let drawH = drawW / aspect;
  if (drawH > mapMaxH) {
    drawH = mapMaxH;
    drawW = drawH * aspect;
  }
  const mapX = 36 + (mapMaxW - drawW) / 2;
  doc.image(params.mapPng, mapX, mapTop, { width: drawW, height: drawH });
  drawFooter(doc, payload, params.reportId, pageNum, pageCount);

  // ── Page 3: Performance (two columns, no overlap) ────────────────
  doc.addPage({ size: "LETTER", layout: "portrait", margins: { ...PAGE_MARGINS } });
  pageNum = 3;
  drawHeader(doc, payload, "Performance");
  doc.y = contentTop + 6;
  doc.fillColor("#18181b").fontSize(14).font("Helvetica-Bold").text("Performance breakdown", 36, doc.y, {
    lineBreak: false,
  });
  doc.y += 20;

  const colGap = 16;
  const colW = (doc.page.width - 72 - colGap) / 2;
  const leftX = 36;
  const rightX = 36 + colW + colGap;
  const sectionTop = doc.y;

  // Left column
  let leftY = sectionTop;
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#18181b").text("Rank distribution", leftX, leftY);
  leftY += 16;
  const maxBucket2 = Math.max(1, ...payload.rankDistribution.map((d) => d.count));
  for (const bucket of payload.rankDistribution) {
    const barW = (colW - 100) * (bucket.count / maxBucket2);
    doc.font("Helvetica").fontSize(8).fillColor("#3f3f46");
    doc.text(bucket.label, leftX, leftY, { width: 70, lineBreak: false });
    doc.roundedRect(leftX + 74, leftY, Math.max(3, barW), 10, 2).fill("#059669");
    doc.fillColor("#18181b").text(String(bucket.count), leftX + 80 + barW, leftY, {
      lineBreak: false,
    });
    leftY += 16;
  }
  leftY += 10;
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#18181b").text("Coverage", leftX, leftY);
  leftY += 14;
  doc.font("Helvetica").fontSize(9).fillColor("#3f3f46");
  const coverageLines = [
    `Found cells: ${k.foundCells} / ${k.totalCells}`,
    `Best rank: ${k.bestRank ?? "-"}`,
    `Worst rank: ${k.worstRank ?? "-"}`,
    `Not found: ${pct(k.notFoundPct)}`,
    `Visibility (top 10): ${pct(k.visibilityScore)}`,
  ];
  for (const line of coverageLines) {
    doc.text(line, leftX, leftY, { width: colW, lineBreak: false });
    leftY += 13;
  }

  // Right column
  let rightY = sectionTop;
  doc.fontSize(11).font("Helvetica-Bold").fillColor("#18181b").text("Heatmap", rightX, rightY);
  rightY += 14;
  if (params.heatmapPng) {
    const heatSize = Math.min(colW, 300);
    doc.image(params.heatmapPng, rightX, rightY, { fit: [heatSize, heatSize] });
    rightY += heatSize + 14;
  } else {
    doc.font("Helvetica").fontSize(9).fillColor("#71717a").text("Heatmap unavailable", rightX, rightY);
    rightY += 20;
  }

  doc.fontSize(10).font("Helvetica-Bold").fillColor("#18181b").text("Market comparison", rightX, rightY);
  rightY += 14;
  const leader = payload.competitors
    .filter((c) => !c.isTarget)
    .slice()
    .sort((a, b) => b.solv - a.solv)[0];
  const you = payload.competitors.find((c) => c.isTarget);
  doc.font("Helvetica").fontSize(9).fillColor("#3f3f46");
  const marketLines = [
    `Your Top 3 %: ${pct(you?.solv ?? k.solv)}`,
    leader
      ? `Leader Top 3 %: ${pct(leader.solv)} (${leader.name.slice(0, 28)})`
      : "Leader Top 3 %: -",
    leader
      ? `Gap to leader: ${fmt((leader.solv ?? 0) - (you?.solv ?? k.solv), 0)} pts`
      : "Gap to leader: -",
    `Competitors listed: ${Math.max(0, competitors.length - (you ? 1 : 0))}`,
    `Average rank: ${fmt(k.arp)}`,
  ];
  for (const line of marketLines) {
    doc.text(line, rightX, rightY, { width: colW, lineBreak: false });
    rightY += 13;
  }

  // Definitions below both columns
  const defsY = Math.max(leftY, rightY) + 16;
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#18181b").text("Metric definitions", 36, defsY);
  let dy = defsY + 14;
  doc.fontSize(8).font("Helvetica").fillColor("#3f3f46");
  const defs = [
    "Avg. rank — Average rank where the business appears in the top 20.",
    "Avg. rank (all cells) — Treats missing cells as rank 21 so absences count.",
    "Top 3 % — Percent of map pins ranking in the local pack (positions 1–3).",
    "Visibility — Percent of cells ranking in the top 10.",
  ];
  for (const line of defs) {
    doc.text(`- ${line}`, 36, dy, { width: doc.page.width - 72 });
    dy += 12;
  }

  drawFooter(doc, payload, params.reportId, pageNum, pageCount);

  // ── Page 4: Competitors (landscape) ──────────────────────────────
  doc.addPage({ size: "LETTER", layout: "landscape", margins: { ...PAGE_MARGINS } });
  pageNum = 4;
  drawHeader(doc, payload, "Competitors");
  doc.y = contentTop + 6;
  doc.fillColor("#18181b").fontSize(13).font("Helvetica-Bold").text("Competitor comparison", 36, doc.y, {
    lineBreak: false,
  });
  doc.y += 16;
  doc.fontSize(8).font("Helvetica").fillColor("#71717a");
  doc.text(
    `Sorted by Top 3 % · Showing ${competitorLimit === "all" ? "all" : `top ${competitorLimit}`} · Target row highlighted · Address wraps under business name`,
    { width: doc.page.width - 72 }
  );
  doc.moveDown(0.35);

  // Columns: # | Business+Address | Rating | Reviews | Found | Top3 pins | Top3% | Avg | Avg all
  const tableLeft = 36;
  const tableWidth = doc.page.width - 72;
  const cols = [
    { key: "#", w: 28 },
    { key: "Business", w: 250 },
    { key: "Rating", w: 48 },
    { key: "Reviews", w: 54 },
    { key: "Found", w: 48 },
    { key: "Top 3", w: 44 },
    { key: "Top 3 %", w: 48 },
    { key: "Avg", w: 44 },
    { key: "Avg all", w: 48 },
  ];
  // Normalize widths to tableWidth
  const sumW = cols.reduce((s, c) => s + c.w, 0);
  const scale = tableWidth / sumW;
  const widths = cols.map((c) => c.w * scale);

  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#3f3f46");
  let x = tableLeft;
  cols.forEach((c, i) => {
    doc.text(c.key, x, y, { width: widths[i], lineBreak: false });
    x += widths[i];
  });
  y += 12;
  doc
    .moveTo(tableLeft, y)
    .lineTo(tableLeft + tableWidth, y)
    .strokeColor("#e4e4e7")
    .stroke();
  y += 6;

  const maxY = doc.page.height - footerReserve - 4;
  const rowH = 22;
  const maxRows = Math.floor((maxY - y) / rowH);
  const shown = competitors.slice(0, Math.max(1, maxRows));

  shown.forEach((row, idx) => {
    if (row.isTarget) {
      doc.rect(tableLeft, y - 2, tableWidth, rowH).fill("#ecfdf5");
    }
    doc.fillColor("#18181b").font("Helvetica").fontSize(8);
    const found = Math.round((row.appearancePct / 100) * row.totalCells);
    const name = row.isTarget ? `[YOU] ${row.name}` : row.name;
    const addr = row.address?.trim() || "";
    const vals = [
      String(idx + 1),
      name,
      row.rating != null ? fmt(row.rating) : "-",
      row.reviewCount != null ? String(row.reviewCount) : "-",
      String(found),
      String(row.top3Appearances ?? "-"),
      pct(row.solv),
      fmt(row.arp),
      fmt(row.atrp),
    ];
    let cx = tableLeft;
    vals.forEach((v, i) => {
      if (i === 1) {
        doc.font("Helvetica-Bold").fontSize(8).text(v.slice(0, 42), cx, y, {
          width: widths[i] - 4,
          lineBreak: false,
          ellipsis: true,
        });
        if (addr) {
          doc.font("Helvetica").fontSize(7).fillColor("#71717a").text(addr.slice(0, 56), cx, y + 10, {
            width: widths[i] - 4,
            lineBreak: false,
            ellipsis: true,
          });
          doc.fillColor("#18181b");
        }
      } else {
        doc.font("Helvetica").fontSize(8).text(v, cx, y + 4, {
          width: widths[i] - 2,
          lineBreak: false,
        });
      }
      cx += widths[i];
    });
    y += rowH;
  });

  if (competitors.length > shown.length) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#71717a")
      .text(`Showing ${shown.length} of ${competitors.length} competitors on this page.`, 36, y + 4, {
        lineBreak: false,
      });
  }

  drawFooter(doc, payload, params.reportId, pageNum, pageCount);

  const buffered = doc.bufferedPageRange();
  if (buffered.count !== pageCount) {
    doc.end();
    await done.catch(() => undefined);
    throw new Error(
      `PDF renderer created ${buffered.count} buffered pages (expected ${pageCount}). Auto page-break likely fired.`
    );
  }

  doc.end();
  const buffer = await done;
  const pdfPagesActual = countPdfPages(buffer);
  if (pdfPagesActual !== pageCount) {
    throw new Error(
      `PDF buffer contains ${pdfPagesActual} pages (expected ${pageCount}).`
    );
  }
  return {
    buffer,
    pdfPagesExpected: pageCount,
    pdfPagesActual,
  };
}
