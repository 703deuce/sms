import { escapeHtml } from "@/lib/reporting/metrics";
import { rankLabel } from "@/lib/maps/grid-metrics";
import { isSectionEnabled } from "@/lib/reporting/report-sections";
import type {
  AnyReportPayload,
  CompetitorReportPayload,
  HeatmapCell,
  KeywordReportPayload,
  LocationReportPayload,
  MapsCampaignReportPayload,
  ReportCompetitorRow,
  ReportKpis,
  ReviewCampaignReportPayload,
  ReviewsReportPayload,
  SingleScanReportPayload,
  TrendReportPayload,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

function payloadSections(payload: AnyReportPayload) {
  return (payload as { sections?: Parameters<typeof isSectionEnabled>[0] }).sections;
}

function payloadExecutiveSummary(payload: AnyReportPayload): string | null {
  const summary = (payload as { executiveSummary?: string | null }).executiveSummary;
  if (!summary?.trim()) return null;
  if (!isSectionEnabled(payloadSections(payload), "executive_summary")) return null;
  return summary.trim();
}

function accent(wl: WhiteLabelConfig): string {
  return wl.accentColor?.trim() || "#059669";
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function reportTitle(type: AnyReportPayload["reportType"]): string {
  switch (type) {
    case "single_scan":
      return "Prospect audit";
    case "trend":
      return "Monthly client report";
    case "competitor":
      return "Competitor visibility";
    case "location":
      return "Location keyword summary";
    case "keyword":
      return "Keyword deep dive";
    case "maps_campaign":
      return "Campaign progress report";
    case "reviews":
      return "Review snapshot";
    case "review_campaign":
      return "Campaign report";
    default:
      return "Maps Report";
  }
}

function periodLabel(payload: AnyReportPayload): string {
  if (payload.reportType === "single_scan" || payload.reportType === "competitor") {
    return payload.parameters.scannedAt;
  }
  if (
    payload.reportType === "trend" ||
    payload.reportType === "location" ||
    payload.reportType === "keyword" ||
    payload.reportType === "maps_campaign"
  ) {
    return `${payload.parameters.dateFrom} → ${payload.parameters.dateTo}`;
  }
  if (payload.reportType === "reviews") {
    return payload.parameters.auditedAt ?? "";
  }
  if (payload.reportType === "review_campaign") {
    return payload.parameters.campaignName;
  }
  return "";
}

function simpleKpiRow(items: Array<{ label: string; value: string }>): string {
  return `<div class="kpi-row">${items
    .map(
      (i) =>
        `<div class="kpi"><span class="kpi-label">${escapeHtml(i.label)}</span><span class="kpi-value">${escapeHtml(i.value)}</span></div>`
    )
    .join("")}</div>`;
}

function kpiCards(kpis: ReportKpis): string {
  const items: Array<{ label: string; value: string }> = [
    { label: "Avg. rank", value: fmt(kpis.arp) },
    { label: "Avg. rank (all cells)", value: fmt(kpis.atrp) },
    { label: "Top 3 %", value: `${fmt(kpis.solv)}%` },
    { label: "Top 10 %", value: `${fmt(kpis.top10Pct)}%` },
    { label: "Visibility", value: `${fmt(kpis.visibilityScore, 0)}` },
    { label: "Best rank", value: fmt(kpis.bestRank, 0) },
    { label: "Pins found", value: `${kpis.foundCells}/${kpis.totalCells}` },
  ];
  return simpleKpiRow(items);
}

/** Rollup reports only have honest avg-rank / Top 3 averages — not cell-level coverage. */
function rollupKpiCards(kpis: ReportKpis, unitLabel: string): string {
  return simpleKpiRow([
    { label: "Avg. rank", value: fmt(kpis.arp) },
    { label: "Avg. rank (all cells)", value: fmt(kpis.atrp) },
    { label: "Top 3 %", value: `${fmt(kpis.solv)}%` },
    { label: unitLabel, value: `${kpis.foundCells}/${kpis.totalCells}` },
  ]);
}

function heatmapHtml(gridSize: number, cells: HeatmapCell[]): string {
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  const tiles = sorted
    .map((c) => {
      const label = rankLabel(c.rank);
      return `<div class="heat-cell" style="background:${escapeHtml(c.color)};color:${escapeHtml(c.textColor)}" title="${escapeHtml(c.label)}: ${escapeHtml(label)}"><span class="heat-rank">${escapeHtml(label)}</span><span class="heat-label">${escapeHtml(c.label)}</span></div>`;
    })
    .join("");
  return `<div class="heatmap" style="grid-template-columns:repeat(${Math.max(1, gridSize)},minmax(0,1fr))">${tiles}</div>`;
}

function competitorTable(
  rows: ReportCompetitorRow[],
  options?: { selectedKeys?: string[]; highlightSelected?: boolean }
): string {
  const selected = new Set(options?.selectedKeys ?? []);
  const body = rows
    .map((c) => {
      const isSel = options?.highlightSelected && (c.isTarget || selected.has(c.key));
      return `<tr class="${c.isTarget ? "is-target" : ""}${isSel ? " is-selected" : ""}">
      <td>${escapeHtml(c.name)}${c.isTarget ? ' <span class="badge">You</span>' : ""}</td>
      <td>${escapeHtml(fmt(c.arp))}</td>
      <td>${escapeHtml(fmt(c.atrp))}</td>
      <td>${escapeHtml(fmt(c.solv))}%</td>
      <td>${c.top3Appearances}</td>
      <td>${escapeHtml(fmt(c.appearancePct))}%</td>
      <td>${c.rating != null ? escapeHtml(String(c.rating)) : "—"}</td>
      <td>${c.reviewCount != null ? escapeHtml(String(c.reviewCount)) : "—"}</td>
    </tr>`;
    })
    .join("");
  return `<table class="data">
    <thead><tr><th>Business</th><th>Avg. rank</th><th>Avg. rank (all)</th><th>Top 3 %</th><th>Top-3 pins</th><th>Appear %</th><th>Rating</th><th>Reviews</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

function trendChartSvg(series: TrendReportPayload["series"]): string {
  const w = 720;
  const h = 220;
  const pad = 36;
  if (series.length < 2) {
    return `<p class="muted">Not enough points to chart.</p>`;
  }

  const arps = series.map((s) => s.arp).filter((n): n is number => n != null);
  const solvs = series.map((s) => s.solv).filter((n): n is number => n != null);
  const minArp = Math.min(...(arps.length ? arps : [1]), 1);
  const maxArp = Math.max(...(arps.length ? arps : [20]), 21);
  const maxSolv = Math.max(100, ...(solvs.length ? solvs : [100]));

  const xAt = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, series.length - 1);
  const yArp = (v: number) => pad + ((v - minArp) / Math.max(0.01, maxArp - minArp)) * (h - pad * 2);
  const ySolv = (v: number) => h - pad - (v / maxSolv) * (h - pad * 2);

  const arpPts = series
    .map((s, i) => (s.arp == null ? null : `${xAt(i).toFixed(1)},${yArp(s.arp).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const solvPts = series
    .map((s, i) => (s.solv == null ? null : `${xAt(i).toFixed(1)},${ySolv(s.solv).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend chart">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#f8fafc"/>
    <polyline fill="none" stroke="#059669" stroke-width="2.5" points="${arpPts}"/>
    <polyline fill="none" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="4 3" points="${solvPts}"/>
    <text x="${pad}" y="16" font-size="11" fill="#059669">Avg. rank (lower better)</text>
    <text x="${w - 140}" y="16" font-size="11" fill="#0ea5e9">Top 3 %</text>
  </svg>`;
}

function comparisonBlock(payload: AnyReportPayload): string {
  if (!isSectionEnabled(payloadSections(payload), "comparison")) return "";
  const comparison = payload.comparison;
  if (!comparison) return "";
  const before = comparison.baselineHeatmap
    ? heatmapHtml(comparison.baselineHeatmap.gridSize, comparison.baselineHeatmap.cells)
    : `<p class="muted">Baseline grid unavailable</p>`;
  const after = comparison.currentHeatmap
    ? heatmapHtml(comparison.currentHeatmap.gridSize, comparison.currentHeatmap.cells)
    : `<p class="muted">Current grid unavailable</p>`;
  return `<section class="page-break">
    <h2>Before-and-after comparison</h2>
    <p class="muted">${escapeHtml(comparison.keyword ?? "Maps grid")}${
      comparison.mode === "baseline" ? " · vs campaign baseline" : " · vs prior period"
    }</p>
    <div class="delta-row">
      <span>Avg. rank change ${escapeHtml(fmt(comparison.kpiDelta.arp))} <small class="muted">(+ = improved)</small></span>
      <span>Top 3 % change ${escapeHtml(fmt(comparison.kpiDelta.solv))} <small class="muted">(+ = improved)</small></span>
    </div>
    <div class="compare-grids">
      <div>
        <h3>${escapeHtml(comparison.baselineLabel)}</h3>
        ${before}
      </div>
      <div>
        <h3>${escapeHtml(comparison.currentLabel)}</h3>
        ${after}
      </div>
    </div>
  </section>`;
}

function aiVisibilityBlock(payload: AnyReportPayload): string {
  if (!isSectionEnabled(payloadSections(payload), "ai_visibility")) return "";
  const ai = payload.aiVisibility;
  if (!ai?.hasData) {
    return `<section class="page-break">
      <h2>AI visibility</h2>
      <p class="muted">No AI Visibility runs yet for this location. Run a check from AI Visibility, or turn this section off for Maps-only deliverables.</p>
    </section>`;
  }
  const scoreDelta =
    ai.visibilityScore != null && ai.previousVisibilityScore != null
      ? Math.round((ai.visibilityScore - ai.previousVisibilityScore) * 10) / 10
      : null;
  const engines = ai.engines
    .map(
      (e) =>
        `<tr><td>${escapeHtml(e.engine)}</td><td>${e.mentioned ? "Mentioned" : "Not mentioned"}</td><td>${escapeHtml(e.status)}</td></tr>`
    )
    .join("");
  const prompts = ai.prompts
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.text)}</td><td>${
          p.mentioned == null ? "—" : p.mentioned ? "Yes" : "No"
        }</td></tr>`
    )
    .join("");
  const comps = ai.competitors
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.name)}</td><td>${c.mentions}</td></tr>`
    )
    .join("");
  return `<section class="page-break">
    <h2>AI visibility</h2>
    <p class="muted">Latest run ${escapeHtml(ai.runAt ?? "—")}${
      ai.previousRunAt ? ` · prior ${escapeHtml(ai.previousRunAt)}` : ""
    }</p>
    ${simpleKpiRow([
      { label: "Coverage score", value: fmt(ai.visibilityScore, 0) },
      {
        label: "vs prior",
        value: scoreDelta == null ? "—" : `${scoreDelta > 0 ? "+" : ""}${scoreDelta}`,
      },
      {
        label: "Mentioned",
        value:
          ai.targetMentioned == null ? "—" : ai.targetMentioned ? "Yes" : "No",
      },
      {
        label: "Engines / prompts",
        value: `${ai.enginesChecked} / ${ai.promptsChecked}`,
      },
    ])}
    ${ai.summary ? `<p>${escapeHtml(ai.summary)}</p>` : ""}
    ${
      engines
        ? `<h3>Platforms checked</h3><table class="data"><thead><tr><th>Platform</th><th>Your business</th><th>Status</th></tr></thead><tbody>${engines}</tbody></table>`
        : ""
    }
    ${
      prompts
        ? `<h3>Prompts</h3><table class="data"><thead><tr><th>Prompt</th><th>Mentioned</th></tr></thead><tbody>${prompts}</tbody></table>`
        : ""
    }
    ${
      comps
        ? `<h3>Competitor mentions</h3><table class="data"><thead><tr><th>Name</th><th>Mentions</th></tr></thead><tbody>${comps}</tbody></table>`
        : ""
    }
    <p class="muted">${escapeHtml(ai.methodology)}</p>
  </section>`;
}

function narrativeBlocks(payload: AnyReportPayload): string {
  const sections = payloadSections(payload);
  const parts: string[] = [];
  if (
    isSectionEnabled(sections, "work_completed") &&
    payload.workCompleted?.trim()
  ) {
    parts.push(
      `<section><h2>Work completed</h2><p>${escapeHtml(payload.workCompleted.trim())}</p></section>`
    );
  }
  if (
    isSectionEnabled(sections, "freelancer_notes") &&
    payload.freelancerNotes?.trim()
  ) {
    parts.push(
      `<section><h2>Notes</h2><p>${escapeHtml(payload.freelancerNotes.trim())}</p></section>`
    );
  }
  if (isSectionEnabled(sections, "next_steps") && payload.nextSteps?.trim()) {
    parts.push(
      `<section><h2>Next steps</h2><p>${escapeHtml(payload.nextSteps.trim())}</p></section>`
    );
  }
  return parts.join("");
}

function coverBlock(payload: AnyReportPayload, bizName: string): string {
  if (!isSectionEnabled(payloadSections(payload), "cover")) return "";
  const wl = payload.whiteLabel;
  const period = payload.periodLabel?.trim() || periodLabel(payload);
  return `<section class="cover">
    ${wl.logoUrl ? `<img class="cover-logo" src="${escapeHtml(wl.logoUrl)}" alt="${escapeHtml(wl.companyName)}"/>` : ""}
    <div class="cover-brand">${escapeHtml(wl.companyName)}</div>
    <h1 class="cover-title">${escapeHtml(reportTitle(payload.reportType))}</h1>
    <p class="cover-client">${escapeHtml(bizName)}</p>
    <p class="cover-period">${escapeHtml(period)}</p>
    <p class="muted">Prepared ${escapeHtml(new Date(payload.generatedAt).toLocaleDateString())}</p>
  </section>`;
}

function shell(
  payload: AnyReportPayload,
  body: string
): string {
  const wl = payload.whiteLabel;
  const color = accent(wl);
  const bizName =
    "name" in payload.business ? payload.business.name : "Business";
  const footerBits = [
    wl.footerText?.trim() || null,
    wl.contactLine?.trim() || null,
    `Generated ${payload.generatedAt}`,
  ].filter(Boolean);
  const executiveSummary = payloadExecutiveSummary(payload);
  const summaryBlock = executiveSummary
    ? `<section><h2>Executive summary</h2><p>${escapeHtml(executiveSummary)}</p></section>`
    : "";
  const footerEnabled = isSectionEnabled(payloadSections(payload), "footer");
  const hidePlatform = Boolean(wl.hidePlatformBranding);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(reportTitle(payload.reportType))} — ${escapeHtml(bizName)}</title>
  <style>
    :root { --accent: ${escapeHtml(color)}; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --bg: #ffffff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: var(--ink); background: linear-gradient(180deg,#f8fafc 0%,#fff 240px); }
    .wrap { max-width: 960px; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
    header.report-header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; border-bottom: 2px solid var(--accent); padding-bottom: 0.85rem; margin-bottom: 1.25rem; }
    .brand { display: flex; gap: 0.75rem; align-items: center; }
    .brand img { max-height: 40px; max-width: 140px; object-fit: contain; }
    .brand-name { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-size: 1.45rem; font-weight: 700; letter-spacing: -0.02em; color: var(--accent); }
    .meta { text-align: right; font-size: 0.8rem; color: var(--muted); line-height: 1.45; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    .meta strong { color: var(--ink); font-weight: 650; }
    h1 { font-size: 1.15rem; margin: 0 0 0.25rem; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    h2 { font-size: 0.95rem; margin: 1.4rem 0 0.55rem; color: var(--ink); font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    h3 { font-size: 0.82rem; margin: 0.85rem 0 0.4rem; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .muted { color: var(--muted); font-size: 0.85rem; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0.5rem; margin: 0.75rem 0 1rem; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    .kpi { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 0.45rem 0.65rem; display: flex; flex-direction: column; min-height: 58px; }
    .kpi-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    .kpi-value { font-size: 1.2rem; font-weight: 700; color: var(--accent); line-height: 1.2; }
    .heatmap { display: grid; gap: 3px; margin: 0.5rem 0 1rem; }
    .heat-cell { aspect-ratio: 1; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; }
    .heat-label { font-size: 0.55rem; font-weight: 500; opacity: 0.85; }
    .compare-grids { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    table.data { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    table.data th, table.data td { border-bottom: 1px solid var(--line); padding: 0.4rem 0.35rem; text-align: left; }
    table.data th { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); }
    tr.is-target td { background: #ecfdf5; font-weight: 600; }
    tr.is-selected td { box-shadow: inset 3px 0 0 var(--accent); }
    .badge { display: inline-block; background: var(--accent); color: #fff; border-radius: 3px; font-size: 0.65rem; padding: 0.1rem 0.35rem; margin-left: 0.25rem; font-weight: 700; }
    .dist { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 0.5rem; }
    .dist-item { border: 1px solid var(--line); border-radius: 8px; padding: 0.5rem 0.65rem; }
    .dist-item strong { display: block; font-size: 1.1rem; color: var(--accent); }
    .chart { width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; }
    .delta-row { display: flex; gap: 1rem; flex-wrap: wrap; margin: 0.5rem 0 1rem; font-size: 0.85rem; }
    .delta-row span { border: 1px solid var(--line); border-radius: 6px; padding: 0.35rem 0.6rem; background: #fff; }
    footer.report-footer { margin-top: 2rem; padding-top: 0.75rem; border-top: 1px solid var(--line); font-size: 0.72rem; color: var(--muted); display: flex; justify-content: space-between; gap: 1rem; }
    .page-break { break-before: page; page-break-before: always; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.35rem 0 0.75rem; }
    .chip { font-size: 0.75rem; border: 1px solid var(--line); border-radius: 999px; padding: 0.15rem 0.55rem; }
    .chip.up { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
    .chip.down { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
    .cover { min-height: 70vh; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 0.35rem; border-bottom: 2px solid var(--accent); margin-bottom: 1.5rem; padding: 2rem 0 2.5rem; page-break-after: always; break-after: page; }
    .cover-logo { max-height: 56px; max-width: 200px; object-fit: contain; margin-bottom: 0.75rem; }
    .cover-brand { font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; font-size: 1.75rem; font-weight: 700; color: var(--accent); letter-spacing: -0.02em; }
    .cover-title { font-size: 1.35rem; margin: 0.5rem 0 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    .cover-client { font-size: 1.05rem; margin: 0.35rem 0 0; font-weight: 600; }
    .cover-period { margin: 0.15rem 0 0; color: var(--muted); font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 0.9rem; }
    @page { margin: 12mm; }
    @media print {
      body { background: #fff; counter-reset: page; }
      .kpi, .dist-item, .heat-cell, table.data tr.is-target td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      a { color: inherit; text-decoration: none; }
      .page-num::after { counter-increment: page; content: "Page " counter(page); }
    }
    @media (max-width: 720px) {
      .kpi-row, .dist, .compare-grids { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .compare-grids { grid-template-columns: 1fr; }
      header.report-header { flex-direction: column; }
      .meta { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${coverBlock(payload, bizName)}
    <header class="report-header">
      <div class="brand">
        ${wl.logoUrl ? `<img src="${escapeHtml(wl.logoUrl)}" alt="${escapeHtml(wl.companyName)}"/>` : ""}
        <div>
          <div class="brand-name">${escapeHtml(wl.companyName)}</div>
          <h1>${escapeHtml(reportTitle(payload.reportType))}</h1>
        </div>
      </div>
      <div class="meta">
        <div><strong>${escapeHtml(bizName)}</strong></div>
        <div>${escapeHtml(payload.periodLabel?.trim() || periodLabel(payload))}</div>
      </div>
    </header>
    ${summaryBlock}
    ${body}
    ${comparisonBlock(payload)}
    ${aiVisibilityBlock(payload)}
    ${narrativeBlocks(payload)}
    ${
      footerEnabled
        ? `<footer class="report-footer">
      <div>${footerBits.map((b) => escapeHtml(String(b))).join(" · ")}${
          hidePlatform ? "" : ""
        }</div>
      <div class="page-num"></div>
    </footer>`
        : ""
    }
  </div>
</body>
</html>`;
}

function renderSingleScan(payload: SingleScanReportPayload): string {
  const sections = payloadSections(payload);
  const dist = payload.rankDistribution
    .map(
      (d) =>
        `<div class="dist-item"><strong>${d.count}</strong><span class="muted">${escapeHtml(d.label)}</span></div>`
    )
    .join("");
  const reviewBits: string[] = [];
  if (payload.business.rating != null) {
    reviewBits.push(`★ ${fmt(payload.business.rating)}`);
  }
  if (payload.business.reviewCount != null) {
    reviewBits.push(`${payload.business.reviewCount.toLocaleString()} reviews`);
  }
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · ${payload.parameters.gridSize}×${payload.parameters.gridSize} · ${payload.parameters.radiusMeters}m${payload.parameters.centerLabel ? ` · ${escapeHtml(payload.parameters.centerLabel)}` : ""}</p>
    ${
      reviewBits.length && isSectionEnabled(sections, "review_snapshot")
        ? `<p class="muted">Review snapshot: ${escapeHtml(reviewBits.join(" · "))} <span class="muted">(context only)</span></p>`
        : ""
    }
    ${
      isSectionEnabled(sections, "maps_overview")
        ? `<h2>Google Maps overview</h2>${kpiCards(payload.kpis)}`
        : ""
    }
    ${
      isSectionEnabled(sections, "maps_grid")
        ? `<h2>Maps grid</h2>${heatmapHtml(payload.heatmap.gridSize, payload.heatmap.cells)}
    <h2>Rank distribution</h2>
    <div class="dist">${dist}</div>`
        : ""
    }
    ${
      isSectionEnabled(sections, "competitors")
        ? `<section class="page-break">
      <h2>Competitor visibility</h2>
      ${competitorTable(payload.competitors)}
    </section>`
        : ""
    }`;
  return shell(payload, body);
}

function renderTrend(payload: TrendReportPayload): string {
  const sections = payloadSections(payload);
  const overview = isSectionEnabled(sections, "maps_overview")
    ? `<div class="delta-row">
      <span>Avg. rank ${escapeHtml(fmt(payload.current.arp))} <small class="muted">(change ${escapeHtml(fmt(payload.deltas.arp))} vs prior · + = improved)</small></span>
      <span>Avg. rank (all cells) ${escapeHtml(fmt(payload.current.atrp))} <small class="muted">(change ${escapeHtml(fmt(payload.deltas.atrp))} · + = improved)</small></span>
      <span>Top 3 % ${escapeHtml(fmt(payload.current.solv))}% <small class="muted">(change ${escapeHtml(fmt(payload.deltas.solv))} · + = improved)</small></span>
    </div>`
    : "";
  const trend =
    isSectionEnabled(sections, "trend") || isSectionEnabled(sections, "maps_overview")
      ? `<h2>Trend</h2>${trendChartSvg(payload.series)}
    <h2>Series</h2>
    <table class="data">
      <thead><tr><th>Date</th><th>Avg. rank</th><th>Avg. rank (all)</th><th>Top 3 %</th><th>Visibility</th></tr></thead>
      <tbody>
        ${payload.series
          .map(
            (s) => `<tr>
          <td>${escapeHtml(s.date)}</td>
          <td>${escapeHtml(fmt(s.arp))}</td>
          <td>${escapeHtml(fmt(s.atrp))}</td>
          <td>${escapeHtml(fmt(s.solv))}%</td>
          <td>${escapeHtml(fmt(s.visibilityScore, 0))}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`
      : "";
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · ${payload.parameters.gridSize}×${payload.parameters.gridSize} · ${payload.parameters.radiusMeters}m · ${payload.parameters.scanCount} scans</p>
    ${overview}
    ${trend}`;
  return shell(payload, body);
}

function renderCompetitor(payload: CompetitorReportPayload): string {
  const selectedSet = new Set(payload.selectedCompetitorKeys);
  const focused = payload.competitors.filter(
    (c) => c.isTarget || selectedSet.has(c.key)
  );
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · scanned ${escapeHtml(payload.parameters.scannedAt)} · ${payload.parameters.gridSize}×${payload.parameters.gridSize}</p>
    <p class="muted">Showing selected competitors (${payload.selectedCompetitorKeys.length}). Full table includes all ranked competitors ordered by average rank across all cells.</p>
    <h2>Selected set</h2>
    ${competitorTable(focused.length ? focused : [payload.target], {
      selectedKeys: payload.selectedCompetitorKeys,
      highlightSelected: true,
    })}
    <section class="page-break">
      <h2>All competitors</h2>
      ${competitorTable(payload.competitors, {
        selectedKeys: payload.selectedCompetitorKeys,
        highlightSelected: true,
      })}
    </section>`;
  return shell(payload, body);
}

function renderLocation(payload: LocationReportPayload): string {
  const sections = payloadSections(payload);
  const rising = payload.rising
    .slice(0, 8)
    .map((k) => `<span class="chip up">${escapeHtml(k)}</span>`)
    .join("");
  const falling = payload.falling
    .slice(0, 8)
    .map((k) => `<span class="chip down">${escapeHtml(k)}</span>`)
    .join("");
  const body = `
    <p class="muted">${payload.parameters.keywordCount} keywords · ${escapeHtml(payload.parameters.dateFrom)} → ${escapeHtml(payload.parameters.dateTo)}</p>
    ${isSectionEnabled(sections, "maps_overview") ? rollupKpiCards(payload.aggregate, "Keywords with rank") : ""}
    ${
      isSectionEnabled(sections, "keyword_summary")
        ? `<h2>Rising / falling</h2>
    <div class="chips">${rising || '<span class="muted">No rising keywords</span>'}</div>
    <div class="chips">${falling || '<span class="muted">No falling keywords</span>'}</div>
    <h2>Keywords</h2>
    <table class="data">
      <thead><tr><th>Keyword</th><th>Avg. rank</th><th>Avg. rank (all)</th><th>Top 3 %</th><th>Change</th><th>Last scan</th></tr></thead>
      <tbody>
        ${payload.keywords
          .map(
            (k) => `<tr>
          <td>${escapeHtml(k.keyword)}</td>
          <td>${escapeHtml(fmt(k.arp))}</td>
          <td>${escapeHtml(fmt(k.atrp))}</td>
          <td>${escapeHtml(fmt(k.solv))}%</td>
          <td>${escapeHtml(fmt(k.changeArp))}</td>
          <td>${escapeHtml(k.scannedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`
        : ""
    }`;
  return shell(payload, body);
}

function renderKeyword(payload: KeywordReportPayload): string {
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.keyword)} · ${payload.parameters.locationCount} locations · ${payload.parameters.gridSize}×${payload.parameters.gridSize} · ${payload.parameters.radiusMeters}m</p>
    ${rollupKpiCards(payload.aggregate, "Locations with rank")}
    <h2>Locations</h2>
    <table class="data">
      <thead><tr><th>Location</th><th>Avg. rank</th><th>Avg. rank (all)</th><th>Top 3 %</th><th>Last scan</th></tr></thead>
      <tbody>
        ${payload.locations
          .map(
            (l) => `<tr>
          <td>${escapeHtml(l.name)}${l.isBusinessLocation ? ' <span class="badge">Primary</span>' : ""}</td>
          <td>${escapeHtml(fmt(l.arp))}</td>
          <td>${escapeHtml(fmt(l.atrp))}</td>
          <td>${escapeHtml(fmt(l.solv))}%</td>
          <td>${escapeHtml(l.scannedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  return shell(payload, body);
}

function renderMapsCampaign(payload: MapsCampaignReportPayload): string {
  const sections = payloadSections(payload);
  const rising = payload.rising
    .slice(0, 8)
    .map((k) => `<span class="chip up">${escapeHtml(k)}</span>`)
    .join("");
  const falling = payload.falling
    .slice(0, 8)
    .map((k) => `<span class="chip down">${escapeHtml(k)}</span>`)
    .join("");
  const scheduleLine = payload.parameters.scheduleEnabled
    ? `Weekly schedule on · next ${escapeHtml(payload.parameters.nextRunAt ?? "—")}`
    : "Weekly schedule off";
  const baselineLine = payload.parameters.baselineScanBatchId
    ? " · change vs campaign baseline"
    : " · change vs prior scan";
  const campaignName = payload.parameters.campaignName
    ? `${escapeHtml(payload.parameters.campaignName)} · `
    : "";
  const body = `
    <p class="muted">${campaignName}${scheduleLine} · ${payload.parameters.keywordCount} keywords${baselineLine}</p>
    ${isSectionEnabled(sections, "maps_overview") ? rollupKpiCards(payload.aggregate, "Keywords with rank") : ""}
    ${
      isSectionEnabled(sections, "keyword_summary")
        ? `<h2>Rising / falling</h2>
    <div class="chips">${rising || '<span class="muted">No rising keywords</span>'}</div>
    <div class="chips">${falling || '<span class="muted">No falling keywords</span>'}</div>
    <h2>Tracked keywords</h2>
    <table class="data">
      <thead><tr><th>Keyword</th><th>Avg. rank</th><th>Avg. rank (all)</th><th>Top 3 %</th><th>Change</th><th>Last scan</th></tr></thead>
      <tbody>
        ${payload.keywords
          .map(
            (k) => `<tr>
          <td>${escapeHtml(k.keyword)}</td>
          <td>${escapeHtml(fmt(k.arp))}</td>
          <td>${escapeHtml(fmt(k.atrp))}</td>
          <td>${escapeHtml(fmt(k.solv))}%</td>
          <td>${escapeHtml(fmt(k.changeArp))}</td>
          <td>${escapeHtml(k.scannedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`
        : ""
    }`;
  return shell(payload, body);
}

function renderReviews(payload: ReviewsReportPayload): string {
  const t = payload.target;
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.auditedAt ?? "Latest momentum audit")}${payload.summary ? ` · ${escapeHtml(payload.summary)}` : ""}</p>
    ${simpleKpiRow([
      { label: "Rating", value: fmt(t.rating) },
      { label: "Total", value: String(t.totalReviews) },
      { label: "30d", value: String(t.reviews30d) },
      { label: "Momentum", value: t.momentumLabel ?? "—" },
      { label: "Score", value: fmt(t.momentumScore, 0) },
      { label: "Resp %", value: t.responseRate != null ? `${t.responseRate}%` : "—" },
      { label: "Unanswered 90d", value: t.unanswered90d != null ? String(t.unanswered90d) : "—" },
      { label: "Gap to top 3", value: fmt(t.gapToTop3_30d, 0) },
    ])}
    <h2>Competitors</h2>
    <table class="data">
      <thead><tr><th>Business</th><th>Rating</th><th>Total</th><th>30d</th><th>Weekly</th><th>Momentum</th></tr></thead>
      <tbody>
        <tr class="is-target">
          <td>${escapeHtml(t.name)} <span class="badge">You</span></td>
          <td>${escapeHtml(fmt(t.rating))}</td>
          <td>${t.totalReviews}</td>
          <td>${t.reviews30d}</td>
          <td>${escapeHtml(fmt(t.avgReviewsPerWeek))}</td>
          <td>${escapeHtml(t.momentumLabel ?? "—")}</td>
        </tr>
        ${payload.competitors
          .map(
            (c) => `<tr>
          <td>${escapeHtml(c.name)}</td>
          <td>${escapeHtml(fmt(c.rating))}</td>
          <td>${c.totalReviews}</td>
          <td>${c.reviews30d}</td>
          <td>${escapeHtml(fmt(c.avgReviewsPerWeek))}</td>
          <td>${escapeHtml(c.momentumLabel ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${
      payload.tasks.length
        ? `<h2>Recommended actions</h2>
    <table class="data">
      <thead><tr><th>Task</th><th>Priority</th></tr></thead>
      <tbody>
        ${payload.tasks
          .map(
            (task) => `<tr>
          <td><strong>${escapeHtml(task.title)}</strong>${task.description ? `<div class="muted">${escapeHtml(task.description)}</div>` : ""}</td>
          <td>${escapeHtml(task.priority ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>`
        : ""
    }`;
  return shell(payload, body);
}

function renderReviewCampaign(payload: ReviewCampaignReportPayload): string {
  const f = payload.funnel;
  const a = payload.attribution;
  const body = `
    <p class="muted">${escapeHtml(payload.parameters.campaignName)} · ${escapeHtml(payload.parameters.status)} · ${escapeHtml(payload.parameters.channel)}</p>
    ${simpleKpiRow([
      { label: "Recipients", value: String(f.recipientsTotal) },
      { label: "Sent", value: String(f.sent) },
      { label: "Delivered", value: String(f.delivered) },
      { label: "Clicked", value: String(f.clicked) },
      { label: "Replied", value: String(f.replied) },
      { label: "Failed", value: String(f.failed) },
      { label: "Opted out", value: String(f.optedOut) },
      { label: "Attributed", value: String(a.confirmed + a.likely) },
    ])}
    <h2>Rates</h2>
    <div class="delta-row">
      <span>Delivery ${escapeHtml(fmt(payload.rates.deliveryRate))}%</span>
      <span>Click ${escapeHtml(fmt(payload.rates.clickRate))}%</span>
      <span>Reply ${escapeHtml(fmt(payload.rates.replyRate))}%</span>
      <span>Attributed ${escapeHtml(fmt(payload.rates.attributedReviewRate))}%</span>
    </div>
    <h2>Attribution</h2>
    <div class="dist">
      <div class="dist-item"><strong>${a.confirmed}</strong><span class="muted">Confirmed</span></div>
      <div class="dist-item"><strong>${a.likely}</strong><span class="muted">Likely</span></div>
      <div class="dist-item"><strong>${a.unattributed}</strong><span class="muted">Unattributed</span></div>
      <div class="dist-item"><strong>${f.sms}/${f.email}</strong><span class="muted">SMS / Email</span></div>
    </div>
    <h2>Recipients (sample)</h2>
    <table class="data">
      <thead><tr><th>Name</th><th>Status</th><th>Channel</th><th>Replied</th><th>Review</th></tr></thead>
      <tbody>
        ${payload.recipients
          .map(
            (r) => `<tr>
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.status)}</td>
          <td>${escapeHtml(r.channel ?? "—")}</td>
          <td>${escapeHtml(r.repliedAt ?? "—")}</td>
          <td>${escapeHtml(r.reviewDetectedAt ?? "—")}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table>
    <section class="page-break">
      <h2>Activity</h2>
      <table class="data">
        <thead><tr><th>When</th><th>Type</th><th>Event</th></tr></thead>
        <tbody>
          ${payload.activity
            .slice(0, 40)
            .map(
              (ev) => `<tr>
            <td>${escapeHtml(ev.at)}</td>
            <td>${escapeHtml(ev.type)}</td>
            <td>${escapeHtml(ev.label)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </section>`;
  return shell(payload, body);
}

export function renderReportHtml(payload: AnyReportPayload): string {
  switch (payload.reportType) {
    case "single_scan":
      return renderSingleScan(payload);
    case "trend":
      return renderTrend(payload);
    case "competitor":
      return renderCompetitor(payload);
    case "location":
      return renderLocation(payload);
    case "keyword":
      return renderKeyword(payload);
    case "maps_campaign":
      return renderMapsCampaign(payload);
    case "reviews":
      return renderReviews(payload);
    case "review_campaign":
      return renderReviewCampaign(payload);
    default: {
      const _exhaustive: never = payload;
      return shell(_exhaustive, "<p>Unsupported report type</p>");
    }
  }
}
