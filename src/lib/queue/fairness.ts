import { createServiceClient } from "@/lib/db/client";
import {
  maxActiveMapsScansPerOrg,
  maxQueuedMapsScansPerOrg,
} from "@/lib/queue/config";
import { getOrganizationPlan } from "@/lib/plans";
import { resolveFreelancerLimits } from "@/lib/plans/resolve-freelancer-limits";

const ACTIVE_SCAN_STATUSES = [
  "queued",
  "dispatching",
  "provider_running",
  "normalizing",
  "enriching",
  "recovering",
  "rank_ready",
] as const;

/** Statuses that mean a scan is actually consuming a concurrent slot. */
const RUNNING_SCAN_STATUSES = [
  "dispatching",
  "provider_running",
  "normalizing",
  "enriching",
  "recovering",
] as const;

export type MapsFairnessResult =
  | { ok: true }
  | { ok: false; reason: string; code: "active_limit" | "queued_limit" | "duplicate" };

export async function resolveOrgMapsConcurrentCap(organizationId: string): Promise<number> {
  const plan = await getOrganizationPlan(organizationId).catch(() => null);
  const freelancerLimits = resolveFreelancerLimits(plan?.id);
  // Internal/admin testing uses the plan's high concurrent cap directly.
  // Paid tiers stay within the global infrastructure ceiling (default 1).
  if (plan?.id === "internal") return freelancerLimits.maxConcurrentScans;
  return Math.min(maxActiveMapsScansPerOrg(), freelancerLimits.maxConcurrentScans);
}

async function orgBusinessIds(organizationId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data: orgBusinesses } = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", organizationId);
  return (orgBusinesses ?? []).map((b) => b.id as string);
}

/**
 * After a worker claims a scan, decide whether this org still has a free slot.
 * Uses oldest-started wins so two simultaneous claims do not both yield (deadlock).
 */
export async function assertOrgMapsScanSlotAvailable(params: {
  organizationId: string;
  scanBatchId: string;
  businessId: string;
}): Promise<MapsFairnessResult> {
  const concurrentCap = await resolveOrgMapsConcurrentCap(params.organizationId);
  if (concurrentCap >= 25) return { ok: true };

  const businessIds = await orgBusinessIds(params.organizationId);
  if (!businessIds.length) return { ok: true };

  const supabase = createServiceClient();
  const { data: running } = await supabase
    .from("scan_batches")
    .select("id, started_at, created_at")
    .in("business_id", businessIds)
    .in("status", [...RUNNING_SCAN_STATUSES])
    .order("started_at", { ascending: true, nullsFirst: false })
    .limit(Math.max(concurrentCap * 4, 8));

  const rows = [...(running ?? [])].sort((a, b) => {
    const aAt = String(a.started_at ?? a.created_at ?? "");
    const bAt = String(b.started_at ?? b.created_at ?? "");
    if (aAt !== bAt) return aAt.localeCompare(bAt);
    return String(a.id).localeCompare(String(b.id));
  });

  const winners = new Set(rows.slice(0, concurrentCap).map((r) => r.id as string));
  if (winners.has(params.scanBatchId) || winners.size < concurrentCap) {
    return { ok: true };
  }

  return {
    ok: false,
    code: "active_limit",
    reason: `Another scan is already running for this account (limit ${concurrentCap}). This scan stays queued and will start next.`,
  };
}

/** Enforce per-org Maps concurrency before accepting another scan. */
export async function assertCanEnqueueMapsScan(params: {
  organizationId: string;
  businessId: string;
  scanBatchId: string;
  keyword?: string | null;
  gridSize?: number | null;
}): Promise<MapsFairnessResult> {
  const supabase = createServiceClient();

  const { count: activeCount } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .eq("business_id", params.businessId)
    .in("status", [...ACTIVE_SCAN_STATUSES])
    .neq("id", params.scanBatchId);

  // Soft check: one business shouldn't stack many actives (org limit below).
  if ((activeCount ?? 0) >= 1) {
    // Allow queueing more for the org, but surface duplicate-like pressure.
  }

  const businessIds = await orgBusinessIds(params.organizationId);
  if (!businessIds.length) return { ok: true };

  const plan = await getOrganizationPlan(params.organizationId).catch(() => null);
  const freelancerLimits = resolveFreelancerLimits(plan?.id);
  const concurrentCap = await resolveOrgMapsConcurrentCap(params.organizationId);

  if (params.gridSize != null && params.gridSize > freelancerLimits.maxGridSize) {
    return {
      ok: false,
      code: "active_limit",
      reason: `Grid size ${params.gridSize}×${params.gridSize} exceeds your plan maximum of ${freelancerLimits.maxGridSize}×${freelancerLimits.maxGridSize}.`,
    };
  }

  const { count: orgActive } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .in("business_id", businessIds)
    .in("status", [...RUNNING_SCAN_STATUSES])
    .neq("id", params.scanBatchId);

  if ((orgActive ?? 0) >= concurrentCap) {
    return {
      ok: false,
      code: "active_limit",
      reason: `You already have ${orgActive} scan(s) running (limit ${concurrentCap} concurrent). Wait for one to finish, then try again.`,
    };
  }

  const { count: orgQueued } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .in("business_id", businessIds)
    .eq("status", "queued")
    .neq("id", params.scanBatchId);

  const queuedCap =
    plan?.id === "internal"
      ? Math.max(maxQueuedMapsScansPerOrg(), 100)
      : maxQueuedMapsScansPerOrg();

  if ((orgQueued ?? 0) >= queuedCap) {
    return {
      ok: false,
      code: "queued_limit",
      reason: `Organization already has ${orgQueued} queued Maps scans (limit ${queuedCap}).`,
    };
  }

  return { ok: true };
}

/** Find an already-running equivalent scan (unused by create/run — re-runs allowed). */
export async function findDuplicateActiveScan(params: {
  businessId: string;
  keywordLabel?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  excludeScanId?: string | null;
}): Promise<{ id: string; status: string } | null> {
  if (!params.keywordLabel || !params.gridSize) return null;
  const supabase = createServiceClient();
  let query = supabase
    .from("scan_batches")
    .select("id, status, grid_size, radius_meters, confidence_summary")
    .eq("business_id", params.businessId)
    .eq("grid_size", params.gridSize)
    .in("status", [...ACTIVE_SCAN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(10);

  if (params.radiusMeters) query = query.eq("radius_meters", params.radiusMeters);
  if (params.excludeScanId) query = query.neq("id", params.excludeScanId);

  const { data } = await query;
  const needle = params.keywordLabel.trim().toLowerCase();
  for (const row of data ?? []) {
    const conf = (row.confidence_summary ?? {}) as { keyword_label?: string };
    const label = conf.keyword_label?.trim().toLowerCase() ?? "";
    if (label && label === needle) {
      return { id: row.id as string, status: String(row.status) };
    }
  }
  return null;
}
