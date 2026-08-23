"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, QrCode, TrendingUp } from "lucide-react";
import { QrKpiCard, qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

function isThisMonth(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function QrPerformanceCard({ businessId }: { businessId: string }) {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<ReviewQrCampaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/reputation/qr-campaigns?businessId=${encodeURIComponent(businessId)}&status=all`
        );
        const json = (await res.json()) as { campaigns?: ReviewQrCampaign[]; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        if (!cancelled) setCampaigns(json.campaigns ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const summary = useMemo(() => {
    const active = campaigns.filter((c) => c.status === "active").length;
    const totalScans = campaigns.reduce((n, c) => n + (c.totalScans || 0), 0);
    const unique = campaigns.reduce((n, c) => n + (c.estimatedUniqueScans || 0), 0);
    const scannedThisMonth = campaigns.filter((c) => isThisMonth(c.lastScannedAt)).length;
    return { active, totalScans, unique, scannedThisMonth, count: campaigns.length };
  }, [campaigns]);

  const top = useMemo(() => {
    let best: ReviewQrCampaign | null = null;
    for (const c of campaigns) {
      if ((c.totalScans || 0) <= 0) continue;
      if (!best || c.totalScans > best.totalScans) best = c;
    }
    return best;
  }, [campaigns]);

  return (
    <div
      className={cn(
        qrUi.card,
        "overflow-hidden border-l-4 border-l-[#16A34A] p-5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#027A48]">
            Review acquisition · QR
          </p>
          <h3 className="mt-1 text-lg font-bold text-[#0B1B32]">QR campaign performance</h3>
          <p className="mt-0.5 text-xs text-[#667085]">
            One of the tools that grow Google reviews — measured scans, correlated reviews
          </p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A]">
          <QrCode className="h-5 w-5" />
        </span>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin text-[#16A34A]" /> Loading…
        </div>
      ) : error ? (
        <p className="mt-5 text-sm text-[#667085]">QR stats unavailable right now.</p>
      ) : summary.count === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[#A6F4C5] bg-[#ECFDF3]/40 p-4">
          <p className="text-sm text-[#486581]">
            No tracked QR campaigns yet. Create a front-desk poster to start measuring scans.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <QrKpiCard label="Total scans" value={summary.totalScans.toLocaleString()} />
            <QrKpiCard label="Est. unique" value={summary.unique.toLocaleString()} />
            <QrKpiCard
              label="Active / scanned"
              value={`${summary.active} / ${summary.scannedThisMonth}`}
              hint="Active campaigns / scanned this month"
            />
          </div>
          {top ? (
            <p className="mt-3 text-sm text-[#486581]">
              Top placement:{" "}
              <Link
                href={`/businesses/${businessId}/reputation/qr-campaigns/${top.id}`}
                className="font-semibold text-[#027A48] hover:underline"
              >
                {top.name}
              </Link>{" "}
              · {top.totalScans.toLocaleString()} scans
            </p>
          ) : null}
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/businesses/${businessId}/reputation/qr-campaigns`}
          className={cn(qrUi.btnPrimary)}
        >
          <TrendingUp className="h-4 w-4" />
          View QR Campaigns
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href={`/businesses/${businessId}/reputation/qr-campaigns/new`}
          className={qrUi.btnSecondary}
        >
          New placement
        </Link>
      </div>
    </div>
  );
}
