import { createServiceClient } from "@/lib/db/client";
import { buildComparisonSection } from "@/lib/reporting/comparison-heatmaps";
import { buildLocationReport } from "@/lib/reporting/build-location";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type {
  MapsCampaignReportPayload,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

/**
 * Maps Campaign report = keyword-group progress for a maps_campaigns row
 * (falls back to scheduled_scans when no campaignId is provided).
 * Uses campaign.baseline_scan_batch_id for Δ and before/after grids when set.
 */
export async function buildMapsCampaignReport(params: {
  businessId: string;
  campaignId?: string | null;
  whiteLabel?: Partial<WhiteLabelConfig>;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<MapsCampaignReportPayload> {
  const supabase = createServiceClient();

  let campaign: {
    id: string;
    name: string;
    schedule_enabled: boolean | null;
    schedule_type: string | null;
    next_scheduled_at: string | null;
    default_grid_size: number | null;
    default_radius_meters: number | null;
    baseline_scan_batch_id: string | null;
  } | null = null;

  if (params.campaignId) {
    const { data } = await supabase
      .from("maps_campaigns")
      .select(
        "id, name, schedule_enabled, schedule_type, next_scheduled_at, default_grid_size, default_radius_meters, baseline_scan_batch_id"
      )
      .eq("id", params.campaignId)
      .eq("business_id", params.businessId)
      .maybeSingle();
    campaign = data;
  }

  const baselineScanBatchId = campaign?.baseline_scan_batch_id ?? null;

  const location = await buildLocationReport({
    businessId: params.businessId,
    whiteLabel: params.whiteLabel,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    baselineScanBatchId,
  });

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, organization_id, address_text")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    business,
    params.whiteLabel
  );

  if (!campaign) {
    const { data: schedule } = await supabase
      .from("scheduled_scans")
      .select(
        "enabled, next_run_at, last_run_at, cron_expression, grid_size, radius_meters"
      )
      .eq("business_id", params.businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const topKeyword = location.keywords[0];
    let comparison = null;
    if (topKeyword?.scanId && topKeyword.priorScanId) {
      comparison = await buildComparisonSection({
        businessId: params.businessId,
        baselineScanId: topKeyword.priorScanId,
        currentScanId: topKeyword.scanId,
        mode: "prior_period",
        keywordId: topKeyword.keywordId,
      });
    }

    return {
      reportType: "maps_campaign",
      business: {
        id: business.id,
        name: business.name,
        address: business.address_text ?? null,
      },
      parameters: {
        campaignId: null,
        campaignName: null,
        scheduleEnabled: Boolean(schedule?.enabled),
        cronExpression: (schedule?.cron_expression as string | null) ?? null,
        nextRunAt: (schedule?.next_run_at as string | null) ?? null,
        lastRunAt: (schedule?.last_run_at as string | null) ?? null,
        gridSize: (schedule?.grid_size as number | null) ?? null,
        radiusMeters: (schedule?.radius_meters as number | null) ?? null,
        keywordCount: location.parameters.keywordCount,
        dateFrom: location.parameters.dateFrom,
        dateTo: location.parameters.dateTo,
        baselineScanBatchId: null,
        comparisonMode: "prior_period",
      },
      aggregate: location.aggregate,
      keywords: location.keywords,
      rising: location.rising,
      falling: location.falling,
      whiteLabel,
      generatedAt: new Date().toISOString(),
      comparison,
      periodLabel: location.periodLabel,
    };
  }

  const { data: campaignKeywords } = await supabase
    .from("business_keywords")
    .select("id, keyword")
    .eq("business_id", params.businessId)
    .eq("campaign_id", campaign.id)
    .eq("active", true);

  const keywordFilter = new Set(
    (campaignKeywords ?? []).map((k) => String(k.keyword).trim().toLowerCase())
  );
  const keywords =
    keywordFilter.size > 0
      ? location.keywords.filter((k) =>
          keywordFilter.has(k.keyword.trim().toLowerCase())
        )
      : location.keywords;

  const rising = location.rising.filter((k) =>
    keywordFilter.size ? keywordFilter.has(k.trim().toLowerCase()) : true
  );
  const falling = location.falling.filter((k) =>
    keywordFilter.size ? keywordFilter.has(k.trim().toLowerCase()) : true
  );

  // Prefer before/after for the keyword that owns the baseline scan, else top keyword.
  let comparison = null;
  const baselineKeyword =
    baselineScanBatchId != null
      ? keywords.find((k) => k.priorScanId === baselineScanBatchId) ??
        keywords.find((k) => k.scanId === baselineScanBatchId)
      : null;
  const compareKeyword = baselineKeyword ?? keywords[0];
  if (compareKeyword?.scanId && compareKeyword.priorScanId) {
    comparison = await buildComparisonSection({
      businessId: params.businessId,
      baselineScanId: compareKeyword.priorScanId,
      currentScanId: compareKeyword.scanId,
      mode: baselineScanBatchId ? "baseline" : "prior_period",
      baselineLabel: baselineScanBatchId ? "Campaign baseline" : undefined,
      currentLabel: "Latest scan",
      keywordId: compareKeyword.keywordId,
    });
  }

  return {
    reportType: "maps_campaign",
    business: {
      id: business.id,
      name: business.name,
      address: business.address_text ?? null,
    },
    parameters: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      scheduleEnabled: Boolean(campaign.schedule_enabled),
      cronExpression: campaign.schedule_type ?? null,
      nextRunAt: campaign.next_scheduled_at ?? null,
      lastRunAt: null,
      gridSize: campaign.default_grid_size ?? null,
      radiusMeters: campaign.default_radius_meters ?? null,
      keywordCount: keywords.length || location.parameters.keywordCount,
      dateFrom: location.parameters.dateFrom,
      dateTo: location.parameters.dateTo,
      baselineScanBatchId,
      comparisonMode: baselineScanBatchId ? "baseline" : "prior_period",
    },
    aggregate: location.aggregate,
    keywords,
    rising,
    falling,
    whiteLabel,
    generatedAt: new Date().toISOString(),
    comparison,
    periodLabel: location.periodLabel,
  };
}
