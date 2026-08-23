"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Copy,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import {
  QrEmptyState,
  QrKpiCard,
  QrStatusBadge,
  QrUpgradeBanner,
  qrUi,
} from "@/components/reputation/qr-campaigns/qr-ui";
import {
  QR_PLACEMENT_LABELS,
  QR_PLACEMENT_TYPES,
  type QrPlacementType,
  type ReviewQrCampaign,
} from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

type ListResponse = {
  campaigns?: ReviewQrCampaign[];
  canCreateMore?: boolean;
  limits?: { maxActive: number; activeCount: number };
  error?: string;
  limitKey?: string;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function placementLabel(c: ReviewQrCampaign): string {
  if (c.placementType === "custom" && c.customPlacementLabel) return c.customPlacementLabel;
  return QR_PLACEMENT_LABELS[c.placementType] ?? c.placementType;
}

/** Tiny visual trend cue when we only have aggregate scan totals. */
function MiniSpark({ scans, max }: { scans: number; max: number }) {
  const level = max <= 0 ? 0 : scans / max;
  const bars = [0.35, 0.55, 0.45, 0.75, 0.6, 1].map((f, i) =>
    Math.max(0.12, f * (0.35 + level * 0.65) * (i === 5 ? 1 : 0.85 + level * 0.15))
  );
  return (
    <span className="inline-flex h-5 items-end gap-0.5" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-1 rounded-sm bg-[#16A34A]/80"
          style={{ height: `${Math.round(h * 100)}%` }}
        />
      ))}
    </span>
  );
}

export function QrCampaignsList({ businessId }: { businessId: string }) {
  const router = useRouter();
  const plansHref = `/businesses/${businessId}/reputation/qr-campaigns/plans`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<ReviewQrCampaign[]>([]);
  const [canCreateMore, setCanCreateMore] = useState(true);
  const [limits, setLimits] = useState<{ maxActive: number; activeCount: number } | null>(null);
  const [search, setSearch] = useState("");
  const [placement, setPlacement] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ businessId, status: "all" });
      const res = await fetch(`/api/reputation/qr-campaigns?${params}`);
      const json = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(json.error ?? "Failed to load campaigns");
      setCampaigns(json.campaigns ?? []);
      setCanCreateMore(json.canCreateMore !== false);
      setLimits(json.limits ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (placement !== "all" && c.placementType !== placement) return false;
      if (!q) return true;
      const hay = `${c.name} ${placementLabel(c)} ${c.shortCode}`.toLowerCase();
      return hay.includes(q);
    });
  }, [campaigns, placement, search, status]);

  const summary = useMemo(() => {
    const totalScans = campaigns.reduce((n, c) => n + (c.totalScans || 0), 0);
    const totalUnique = campaigns.reduce((n, c) => n + (c.estimatedUniqueScans || 0), 0);
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
    return { totalScans, totalUnique, activeCampaigns };
  }, [campaigns]);

  const maxScans = useMemo(
    () => Math.max(1, ...campaigns.map((c) => c.totalScans || 0)),
    [campaigns]
  );

  const topPerformerId = useMemo(() => {
    let best: ReviewQrCampaign | null = null;
    for (const c of campaigns) {
      if ((c.totalScans || 0) <= 0) continue;
      if (!best || c.totalScans > best.totalScans) best = c;
    }
    return best?.id ?? null;
  }, [campaigns]);

  async function duplicate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action: "duplicate" }),
      });
      const json = (await res.json()) as { campaign?: ReviewQrCampaign; error?: string; limitKey?: string };
      if (!res.ok) throw new Error(json.error ?? "Duplicate failed");
      if (json.campaign?.id) {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns/${json.campaign.id}`);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(c: ReviewQrCampaign) {
    const next = c.status === "active" ? "paused" : "active";
    setBusyId(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, patch: { status: next } }),
      });
      const json = (await res.json()) as { error?: string; limitKey?: string };
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) {
          throw new Error(
            json.error ??
              "Plan limit reached. Pause another campaign or upgrade to activate more."
          );
        }
        throw new Error(json.error ?? "Could not update status");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ModulePage className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={qrUi.title}>QR Campaigns</h1>
          <p className={qrUi.subtitle}>
            Tracked Google review QR codes and Payment, Tip &amp; Review QR pages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateMore ? (
            <Link
              href={`/businesses/${businessId}/reputation/qr-campaigns/new`}
              className={qrUi.btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Create New Campaign
            </Link>
          ) : (
            <button type="button" className={cn(qrUi.btnPrimary, "cursor-not-allowed opacity-60")} disabled>
              <Plus className="h-4 w-4" />
              Create New Campaign
            </button>
          )}
        </div>
      </div>

      {!canCreateMore ? (
        <QrUpgradeBanner
          title="Campaign limit reached"
          body={
            limits
              ? `You're using ${limits.activeCount} of ${limits.maxActive} active QR campaigns. Pause a campaign or upgrade to track more placements.`
              : "Your plan's active QR campaign limit is full. Pause a campaign or upgrade to track more placements."
          }
          href={plansHref}
        />
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QrKpiCard label="Total Campaigns" value={campaigns.length} />
        <QrKpiCard label="Total Scans" value={summary.totalScans.toLocaleString()} />
        <QrKpiCard label="Est. Unique" value={summary.totalUnique.toLocaleString()} />
        <QrKpiCard label="Active Campaigns" value={summary.activeCampaigns} />
      </div>

      <div className={cn(qrUi.cardPad, "flex flex-wrap items-end gap-3")}>
        <div className="min-w-[220px] flex-1">
          <label className={qrUi.label}>Search</label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns…"
              className={cn(qrUi.input, "pl-10")}
            />
          </div>
        </div>
        <div className="min-w-[160px]">
          <label className={qrUi.label}>Placement</label>
          <select
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
            className={cn(qrUi.input, "mt-1.5")}
          >
            <option value="all">All placements</option>
            {QR_PLACEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {QR_PLACEMENT_LABELS[t as QrPlacementType]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className={qrUi.label}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(qrUi.input, "mt-1.5")}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin text-[#16A34A]" />
          Loading campaigns…
        </div>
      ) : campaigns.length === 0 ? (
        <QrEmptyState
          title="No QR campaigns yet"
          body="Create a tracked Google review QR code for your front desk, receipts, or job sites."
          action={
            <Link
              href={`/businesses/${businessId}/reputation/qr-campaigns/new`}
              className={qrUi.btnPrimary}
            >
              <Plus className="h-4 w-4" />
              Create your first campaign
            </Link>
          }
        />
      ) : (
        <div className={cn(qrUi.card, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                <tr>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Placement</th>
                  <th className="px-5 py-3.5">Scans</th>
                  <th className="px-5 py-3.5">Unique</th>
                  <th className="px-5 py-3.5">Last scan</th>
                  <th className="px-5 py-3.5">Created</th>
                  <th className="px-5 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[#E6EAF0] transition last:border-0 hover:bg-[#F9FAFB]/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/businesses/${businessId}/reputation/qr-campaigns/${c.id}`}
                          className="font-semibold text-[#0B1B32] hover:text-[#16A34A] hover:underline"
                        >
                          {c.name}
                        </Link>
                        <QrStatusBadge status={c.status} />
                        {c.campaignType === "payment_review" ? (
                          <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8] ring-1 ring-[#BFDBFE]">
                            Payment QR
                          </span>
                        ) : null}
                        {topPerformerId === c.id ? (
                          <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#027A48] ring-1 ring-[#A6F4C5]">
                            Top performer
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#475467]">{placementLabel(c)}</td>
                    <td className="px-5 py-4">
                      <div className="min-w-[110px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#0B1B32]">
                            {c.totalScans.toLocaleString()}
                          </span>
                          <MiniSpark scans={c.totalScans} max={maxScans} />
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E6EAF0]">
                          <div
                            className="h-full rounded-full bg-[#16A34A] transition-all"
                            style={{
                              width: `${Math.max(4, Math.round((c.totalScans / maxScans) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#475467]">
                      {c.estimatedUniqueScans.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-[#475467]">{formatDate(c.lastScannedAt)}</td>
                    <td className="px-5 py-4 text-[#475467]">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          href={`/businesses/${businessId}/reputation/qr-campaigns/${c.id}`}
                          className={cn(qrUi.btnGhost, "h-9 px-2.5 text-xs")}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <Link
                          href={`/businesses/${businessId}/reputation/qr-campaigns/${c.id}/analytics`}
                          className={cn(qrUi.btnGhost, "h-9 px-2.5 text-xs")}
                          title="Analytics"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          Analytics
                        </Link>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => void duplicate(c.id)}
                          className={cn(qrUi.btnGhost, "h-9 px-2.5 text-xs")}
                          title="Duplicate"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Duplicate
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => void toggleStatus(c)}
                          className={cn(qrUi.btnGhost, "h-9 px-2.5 text-xs")}
                          title={c.status === "active" ? "Pause" : "Activate"}
                        >
                          {busyId === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : c.status === "active" ? (
                            <>
                              <Pause className="h-3.5 w-3.5" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" /> Activate
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-[#667085]">
                      No campaigns match your filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
