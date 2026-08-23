import PDFDocument from "pdfkit";
import type {
  AnyReportPayload,
  LocationReportPayload,
  MapsCampaignReportPayload,
  TrendReportPayload,
} from "@/lib/reporting/types";

export const ROLLUP_PDF_TEMPLATE_VERSION = "rollup-pdf-v1";

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "-";
  return Number(n).toFixed(digits);
}

function titleFor(type: AnyReportPayload["reportType"]): string {
  switch (type) {
    case "trend":
      return "Monthly client report";
    case "location":
      return "Location keyword summary";
    case "maps_campaign":
      return "Campaign progress report";
    default:
      return "Maps report";
  }
}

function collectBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function drawChrome(
  doc: PDFKit.PDFDocument,
  payload: AnyReportPayload,
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

function kpiRow(
  doc: PDFKit.PDFDocument,
  items: Array<{ label: string; value: string }>,
  y: number
): number {
  const accent = "#059669";
  const w = (doc.page.width - 72) / Math.min(4, items.length);
  items.slice(0, 4).forEach((item, i) => {
    const x = 36 + i * w;
    doc.roundedRect(x, y, w - 8, 44, 4).strokeColor("#e4e4e7").lineWidth(0.8).stroke();
    doc.fillColor("#71717a").fontSize(7).font("Helvetica").text(item.label, x + 8, y + 8, {
      width: w - 24,
    });
    doc
      .fillColor(accent)
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(item.value, x + 8, y + 22, { width: w - 24 });
  });
  return y + 56;
}

/**
 * Dedicated PDFKit PDF for monthly / location / campaign rollup reports.
 * Complements the HTML share (print) path with a downloadable artifact.
 */
export async function renderRollupPdf(payload: AnyReportPayload): Promise<Buffer> {
  if (
    payload.reportType !== "trend" &&
    payload.reportType !== "location" &&
    payload.reportType !== "maps_campaign"
  ) {
    throw new Error(`Rollup PDF not supported for ${payload.reportType}`);
  }

  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 48, bottom: 48, left: 36, right: 36 },
    info: {
      Title: `${titleFor(payload.reportType)} — ${payload.business.name}`,
      Author: payload.whiteLabel.companyName,
    },
  });
  const done = collectBuffer(doc);

  // Cover
  drawChrome(doc, payload, "Cover");
  let y = 64;
  doc
    .fillColor(payload.whiteLabel.accentColor || "#059669")
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(payload.whiteLabel.companyName, 36, y);
  y = doc.y + 18;
  doc
    .fillColor("#0f172a")
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(titleFor(payload.reportType), 36, y);
  y = doc.y + 10;
  doc
    .fillColor("#0f172a")
    .fontSize(13)
    .font("Helvetica")
    .text(payload.business.name, 36, y);
  y = doc.y + 6;
  const period =
    payload.periodLabel ||
    ("dateFrom" in payload.parameters
      ? `${payload.parameters.dateFrom} – ${payload.parameters.dateTo}`
      : "");
  doc.fillColor("#64748b").fontSize(10).text(period, 36, y);
  y = doc.y + 8;
  doc
    .fillColor("#64748b")
    .fontSize(9)
    .text(`Prepared ${new Date(payload.generatedAt).toLocaleDateString()}`, 36, y);

  if (payload.executiveSummary?.trim()) {
    doc.addPage();
    drawChrome(doc, payload, "Executive summary");
    y = 56;
    doc
      .fillColor("#0f172a")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Executive summary", 36, y);
    y = doc.y + 10;
    doc
      .fillColor("#334155")
      .fontSize(10)
      .font("Helvetica")
      .text(payload.executiveSummary.trim(), 36, y, {
        width: doc.page.width - 72,
        align: "left",
      });
  }

  // Metrics page
  doc.addPage();
  drawChrome(doc, payload, "Metrics");
  y = 56;
  doc
    .fillColor("#0f172a")
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Google Maps overview", 36, y);
  y = doc.y + 12;

  if (payload.reportType === "trend") {
    const t = payload as TrendReportPayload;
    y = kpiRow(doc, [
      { label: "Avg. rank", value: fmt(t.current.arp) },
      { label: "Change vs prior", value: fmt(t.deltas.arp) },
      { label: "Top 3 %", value: `${fmt(t.current.solv)}%` },
      { label: "Scans", value: String(t.parameters.scanCount) },
    ], y);
    doc
      .fillColor("#0f172a")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`Keyword: ${t.parameters.keyword}`, 36, y);
    y = doc.y + 12;
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    for (const point of t.series.slice(-24)) {
      if (y > doc.page.height - 72) {
        doc.addPage();
        drawChrome(doc, payload, "Trend series");
        y = 56;
      }
      doc.text(
        `${new Date(point.date).toLocaleDateString()}  ·  ARP ${fmt(point.arp)}  ·  Top3 ${fmt(point.solv)}%`,
        36,
        y
      );
      y = doc.y + 4;
    }
  } else {
    const rollup = payload as LocationReportPayload | MapsCampaignReportPayload;
    y = kpiRow(doc, [
      { label: "Avg. rank", value: fmt(rollup.aggregate.arp) },
      { label: "Avg. rank (all)", value: fmt(rollup.aggregate.atrp) },
      { label: "Top 3 %", value: `${fmt(rollup.aggregate.solv)}%` },
      { label: "Keywords", value: String(rollup.parameters.keywordCount) },
    ], y);
    if (payload.reportType === "maps_campaign") {
      const mode =
        payload.parameters.comparisonMode === "baseline"
          ? "Change vs campaign baseline"
          : "Change vs prior scan";
      doc.fillColor("#64748b").fontSize(9).font("Helvetica").text(mode, 36, y);
      y = doc.y + 10;
    }
    doc
      .fillColor("#0f172a")
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Keywords", 36, y);
    y = doc.y + 8;
    doc.font("Helvetica").fontSize(8).fillColor("#334155");
    for (const k of rollup.keywords) {
      if (y > doc.page.height - 72) {
        doc.addPage();
        drawChrome(doc, payload, "Keywords");
        y = 56;
      }
      const change =
        k.changeArp == null
          ? "-"
          : `${k.changeArp > 0 ? "+" : ""}${fmt(k.changeArp)}`;
      doc.text(
        `${k.keyword}  ·  ARP ${fmt(k.arp)}  ·  Top3 ${fmt(k.solv)}%  ·  Δ ${change}`,
        36,
        y,
        { width: doc.page.width - 72 }
      );
      y = doc.y + 3;
    }
  }

  if (payload.aiVisibility?.hasData) {
    doc.addPage();
    drawChrome(doc, payload, "AI visibility");
    y = 56;
    const ai = payload.aiVisibility;
    doc
      .fillColor("#0f172a")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("AI visibility", 36, y);
    y = doc.y + 10;
    y = kpiRow(doc, [
      { label: "Coverage", value: fmt(ai.visibilityScore, 0) },
      {
        label: "Mentioned",
        value: ai.targetMentioned == null ? "-" : ai.targetMentioned ? "Yes" : "No",
      },
      { label: "Engines", value: String(ai.enginesChecked) },
      { label: "Prompts", value: String(ai.promptsChecked) },
    ], y);
    if (ai.summary) {
      doc
        .fillColor("#334155")
        .fontSize(9)
        .font("Helvetica")
        .text(ai.summary, 36, y, { width: doc.page.width - 72 });
      y = doc.y + 8;
    }
    doc
      .fillColor("#64748b")
      .fontSize(8)
      .text(ai.methodology, 36, y, { width: doc.page.width - 72 });
  }

  const notes = [
    payload.workCompleted?.trim()
      ? { h: "Work completed", t: payload.workCompleted.trim() }
      : null,
    payload.freelancerNotes?.trim()
      ? { h: "Notes", t: payload.freelancerNotes.trim() }
      : null,
    payload.nextSteps?.trim()
      ? { h: "Next steps", t: payload.nextSteps.trim() }
      : null,
  ].filter(Boolean) as Array<{ h: string; t: string }>;

  if (notes.length) {
    doc.addPage();
    drawChrome(doc, payload, "Appendix");
    y = 56;
    for (const n of notes) {
      doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text(n.h, 36, y);
      y = doc.y + 6;
      doc
        .fillColor("#334155")
        .fontSize(9)
        .font("Helvetica")
        .text(n.t, 36, y, { width: doc.page.width - 72 });
      y = doc.y + 14;
    }
  }

  // Footer contact
  const footer = [payload.whiteLabel.footerText, payload.whiteLabel.contactLine]
    .filter(Boolean)
    .join(" · ");
  if (footer) {
    doc
      .fillColor("#94a3b8")
      .fontSize(8)
      .font("Helvetica")
      .text(footer, 36, doc.page.height - 36, {
        width: doc.page.width - 72,
        align: "center",
      });
  }

  doc.end();
  return done;
}
