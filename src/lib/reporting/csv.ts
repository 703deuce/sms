import { escapeCsv } from "@/lib/reporting/metrics";
import type {
  CompetitorReportPayload,
  KeywordReportPayload,
  LocationReportPayload,
  MapsCampaignReportPayload,
  ReviewCampaignReportPayload,
  ReviewsReportPayload,
  SingleScanReportPayload,
  TrendReportPayload,
} from "@/lib/reporting/types";

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsv).join(",");
}

export function singleScanToCsv(payload: SingleScanReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["scanned_at", payload.parameters.scannedAt]));
  lines.push(row(["grid_size", payload.parameters.gridSize]));
  lines.push(row(["radius_meters", payload.parameters.radiusMeters]));
  lines.push("");
  lines.push(row(["kpi", "value"]));
  lines.push(row(["arp", payload.kpis.arp]));
  lines.push(row(["atrp", payload.kpis.atrp]));
  lines.push(row(["solv", payload.kpis.solv]));
  lines.push(row(["top3_pct", payload.kpis.top3Pct]));
  lines.push(row(["top10_pct", payload.kpis.top10Pct]));
  lines.push(row(["not_found_pct", payload.kpis.notFoundPct]));
  lines.push(row(["visibility_score", payload.kpis.visibilityScore]));
  lines.push(row(["best_rank", payload.kpis.bestRank]));
  lines.push(row(["worst_rank", payload.kpis.worstRank]));
  lines.push(row(["found_cells", payload.kpis.foundCells]));
  lines.push(row(["total_cells", payload.kpis.totalCells]));
  lines.push("");
  lines.push(row(["label", "row", "col", "rank"]));
  for (const cell of payload.heatmap.cells) {
    lines.push(row([cell.label, cell.row, cell.col, cell.rank]));
  }
  lines.push("");
  lines.push(
    row([
      "competitor",
      "key",
      "is_target",
      "arp",
      "atrp",
      "solv",
      "top3_appearances",
      "appearance_pct",
      "rating",
      "reviews",
    ])
  );
  for (const c of payload.competitors) {
    lines.push(
      row([
        c.name,
        c.key,
        c.isTarget ? "yes" : "no",
        c.arp,
        c.atrp,
        c.solv,
        c.top3Appearances,
        c.appearancePct,
        c.rating ?? null,
        c.reviewCount ?? null,
      ])
    );
  }
  lines.push("");
  lines.push(row(["bucket", "count"]));
  for (const d of payload.rankDistribution) {
    lines.push(row([d.label, d.count]));
  }
  return lines.join("\n");
}

export function trendToCsv(payload: TrendReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["date_from", payload.parameters.dateFrom]));
  lines.push(row(["date_to", payload.parameters.dateTo]));
  lines.push(row(["scan_count", payload.parameters.scanCount]));
  lines.push("");
  lines.push(row(["metric", "current", "previous", "delta"]));
  lines.push(row(["arp", payload.current.arp, payload.previous.arp, payload.deltas.arp]));
  lines.push(row(["atrp", payload.current.atrp, payload.previous.atrp, payload.deltas.atrp]));
  lines.push(row(["solv", payload.current.solv, payload.previous.solv, payload.deltas.solv]));
  lines.push("");
  lines.push(row(["scan_id", "date", "arp", "atrp", "solv", "top3_pct", "top10_pct", "visibility_score"]));
  for (const s of payload.series) {
    lines.push(
      row([
        s.scanId,
        s.date,
        s.arp,
        s.atrp,
        s.solv,
        s.top3Pct,
        s.top10Pct,
        s.visibilityScore,
      ])
    );
  }
  return lines.join("\n");
}

export function competitorsToCsv(payload: CompetitorReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["scanned_at", payload.parameters.scannedAt]));
  lines.push(row(["selected_keys", payload.selectedCompetitorKeys.join("|")]));
  lines.push("");
  lines.push(
    row([
      "name",
      "key",
      "is_target",
      "selected",
      "arp",
      "atrp",
      "solv",
      "top3_appearances",
      "appearance_pct",
      "rating",
      "reviews",
      "category",
    ])
  );
  const selected = new Set(payload.selectedCompetitorKeys);
  for (const c of payload.competitors) {
    lines.push(
      row([
        c.name,
        c.key,
        c.isTarget ? "yes" : "no",
        selected.has(c.key) || c.isTarget ? "yes" : "no",
        c.arp,
        c.atrp,
        c.solv,
        c.top3Appearances,
        c.appearancePct,
        c.rating ?? null,
        c.reviewCount ?? null,
        c.category ?? null,
      ])
    );
  }
  return lines.join("\n");
}

export function locationToCsv(payload: LocationReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["date_from", payload.parameters.dateFrom]));
  lines.push(row(["date_to", payload.parameters.dateTo]));
  lines.push(row(["keyword_count", payload.parameters.keywordCount]));
  lines.push(row(["aggregate_arp", payload.aggregate.arp]));
  lines.push(row(["aggregate_atrp", payload.aggregate.atrp]));
  lines.push(row(["aggregate_solv", payload.aggregate.solv]));
  lines.push(row(["rising", payload.rising.join("|")]));
  lines.push(row(["falling", payload.falling.join("|")]));
  lines.push("");
  lines.push(
    row(["keyword", "keyword_id", "scan_id", "scanned_at", "arp", "atrp", "solv", "change_arp"])
  );
  for (const k of payload.keywords) {
    lines.push(
      row([
        k.keyword,
        k.keywordId,
        k.scanId,
        k.scannedAt,
        k.arp,
        k.atrp,
        k.solv,
        k.changeArp,
      ])
    );
  }
  return lines.join("\n");
}

export function keywordToCsv(payload: KeywordReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["keyword_id", payload.parameters.keywordId]));
  lines.push(row(["grid_size", payload.parameters.gridSize]));
  lines.push(row(["radius_meters", payload.parameters.radiusMeters]));
  lines.push(row(["location_count", payload.parameters.locationCount]));
  lines.push(row(["aggregate_arp", payload.aggregate.arp]));
  lines.push(row(["aggregate_atrp", payload.aggregate.atrp]));
  lines.push(row(["aggregate_solv", payload.aggregate.solv]));
  lines.push("");
  lines.push(
    row([
      "location",
      "location_id",
      "is_business_location",
      "scan_id",
      "scanned_at",
      "arp",
      "atrp",
      "solv",
    ])
  );
  for (const l of payload.locations) {
    lines.push(
      row([
        l.name,
        l.locationId,
        l.isBusinessLocation ? "yes" : "no",
        l.scanId,
        l.scannedAt,
        l.arp,
        l.atrp,
        l.solv,
      ])
    );
  }
  return lines.join("\n");
}

export function mapsCampaignToCsv(payload: MapsCampaignReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["schedule_enabled", payload.parameters.scheduleEnabled ? "yes" : "no"]));
  lines.push(row(["next_run_at", payload.parameters.nextRunAt]));
  lines.push(row(["last_run_at", payload.parameters.lastRunAt]));
  lines.push(row(["keyword_count", payload.parameters.keywordCount]));
  lines.push(row(["aggregate_arp", payload.aggregate.arp]));
  lines.push(row(["aggregate_atrp", payload.aggregate.atrp]));
  lines.push(row(["aggregate_solv", payload.aggregate.solv]));
  lines.push(row(["rising", payload.rising.join("|")]));
  lines.push(row(["falling", payload.falling.join("|")]));
  lines.push("");
  lines.push(
    row(["keyword", "keyword_id", "scan_id", "scanned_at", "arp", "atrp", "solv", "change_arp"])
  );
  for (const k of payload.keywords) {
    lines.push(
      row([
        k.keyword,
        k.keywordId,
        k.scanId,
        k.scannedAt,
        k.arp,
        k.atrp,
        k.solv,
        k.changeArp,
      ])
    );
  }
  return lines.join("\n");
}

export function reviewsToCsv(payload: ReviewsReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["run_id", payload.parameters.runId]));
  lines.push(row(["audited_at", payload.parameters.auditedAt]));
  lines.push(row(["summary", payload.summary]));
  lines.push("");
  lines.push(row(["entity", "name", "rating", "total", "reviews_30d", "weekly", "momentum", "score"]));
  lines.push(
    row([
      "target",
      payload.target.name,
      payload.target.rating,
      payload.target.totalReviews,
      payload.target.reviews30d,
      payload.target.avgReviewsPerWeek,
      payload.target.momentumLabel,
      payload.target.momentumScore,
    ])
  );
  for (const c of payload.competitors) {
    lines.push(
      row([
        "competitor",
        c.name,
        c.rating,
        c.totalReviews,
        c.reviews30d,
        c.avgReviewsPerWeek,
        c.momentumLabel,
        c.momentumScore,
      ])
    );
  }
  lines.push("");
  lines.push(row(["task_title", "priority", "description"]));
  for (const t of payload.tasks) {
    lines.push(row([t.title, t.priority, t.description]));
  }
  return lines.join("\n");
}

export function reviewCampaignToCsv(payload: ReviewCampaignReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["campaign", payload.parameters.campaignName]));
  lines.push(row(["status", payload.parameters.status]));
  lines.push(row(["channel", payload.parameters.channel]));
  lines.push("");
  lines.push(row(["metric", "value"]));
  lines.push(row(["recipients_total", payload.funnel.recipientsTotal]));
  lines.push(row(["queued", payload.funnel.queued]));
  lines.push(row(["sent", payload.funnel.sent]));
  lines.push(row(["delivered", payload.funnel.delivered]));
  lines.push(row(["clicked", payload.funnel.clicked]));
  lines.push(row(["failed", payload.funnel.failed]));
  lines.push(row(["opted_out", payload.funnel.optedOut]));
  lines.push(row(["replied", payload.funnel.replied]));
  lines.push(row(["sms", payload.funnel.sms]));
  lines.push(row(["email", payload.funnel.email]));
  lines.push(row(["attr_confirmed", payload.attribution.confirmed]));
  lines.push(row(["attr_likely", payload.attribution.likely]));
  lines.push(row(["attr_unattributed", payload.attribution.unattributed]));
  lines.push(row(["delivery_rate", payload.rates.deliveryRate]));
  lines.push(row(["click_rate", payload.rates.clickRate]));
  lines.push(row(["reply_rate", payload.rates.replyRate]));
  lines.push(row(["attributed_review_rate", payload.rates.attributedReviewRate]));
  lines.push("");
  lines.push(row(["recipient", "status", "channel", "replied_at", "review_detected_at"]));
  for (const r of payload.recipients) {
    lines.push(row([r.name, r.status, r.channel, r.repliedAt, r.reviewDetectedAt]));
  }
  return lines.join("\n");
}
