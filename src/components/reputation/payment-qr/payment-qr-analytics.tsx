"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download, Info, Loader2 } from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { QrKpiCard, qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import type { PaymentQrAnalytics } from "@/lib/reputation/payment-qr/types";
import type { PaymentQrEntitlements } from "@/lib/reputation/payment-qr/entitlements";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe",
  cash_app: "Cash App",
  venmo: "Venmo",
  paypal: "PayPal",
  zelle: "Zelle",
};

export function PaymentQrAnalyticsView({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PaymentQrAnalytics | null>(null);
  const [entitlements, setEntitlements] = useState<PaymentQrEntitlements | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ businessId, days: String(days) });
      const res = await fetch(
        `/api/reputation/qr-campaigns/${campaignId}/payment-analytics?${params}`
      );
      const json = (await res.json()) as PaymentQrAnalytics & {
        error?: string;
        entitlements?: PaymentQrEntitlements;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load analytics");
      setData(json);
      if (json.entitlements) setEntitlements(json.entitlements);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, campaignId, days]);

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        businessId,
        days: String(days),
        format: "csv",
      });
      const res = await fetch(
        `/api/reputation/qr-campaigns/${campaignId}/payment-analytics?${params}`
      );
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payment-qr-analytics-${days}d.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  const base = `/businesses/${businessId}/reputation/qr-campaigns/${campaignId}`;

  return (
    <ModulePage className="space-y-6">
      <div>
        <Link
          href={base}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to campaign
        </Link>
        <h1 className={cn(qrUi.title, "mt-3")}>Pay &amp; Review Page analytics</h1>
        <p className={qrUi.subtitle}>
          Page visits, payment-link clicks, and review-link clicks. Clicks are not verified payments.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-semibold",
                days === d
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                  : "border-[#E2E8F0] text-[#64748B]"
              )}
            >
              {d} days
            </button>
          ))}
        </div>
        {entitlements?.csvExport ? (
          <button
            type="button"
            disabled={exporting || !data}
            onClick={() => void exportCsv()}
            className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV
          </button>
        ) : null}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E40AF]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Payment-app activity represents clicks and selections. Completion cannot be confirmed
          unless the payment provider supplies a verified payment event.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#667085]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QrKpiCard label="Page views" value={String(data.pageViews)} />
            <QrKpiCard label="QR scans" value={String(data.qrScans)} />
            <QrKpiCard
              label="Payment-link clicks"
              value={String(data.paymentLinkClicks)}
            />
            <QrKpiCard
              label="Review-link clicks"
              value={String(data.googleReviewClicks + data.facebookReviewClicks)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className={cn(qrUi.cardPad)}>
              <h2 className="text-sm font-bold text-[#0B1B32]">Clicks by provider</h2>
              <ul className="mt-4 space-y-3">
                {Object.entries(data.providerClicks).map(([key, count]) => (
                  <li key={key} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#334155]">
                      {PROVIDER_LABELS[key] ?? key} selected
                    </span>
                    <span className="font-bold text-[#0B1B32]">{count}</span>
                  </li>
                ))}
                {Object.keys(data.providerClicks).length === 0 && (
                  <li className="text-sm text-[#94A3B8]">No payment-option clicks yet.</li>
                )}
              </ul>
            </div>

            <div className={cn(qrUi.cardPad)}>
              <h2 className="text-sm font-bold text-[#0B1B32]">Conversion rates</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex justify-between">
                  <span className="text-[#64748B]">Scan → page view</span>
                  <span className="font-semibold">
                    {data.conversionRates.scanToPageView != null
                      ? `${(data.conversionRates.scanToPageView * 100).toFixed(0)}%`
                      : "—"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#64748B]">Page view → payment click</span>
                  <span className="font-semibold">
                    {data.conversionRates.pageViewToPaymentClick != null
                      ? `${(data.conversionRates.pageViewToPaymentClick * 100).toFixed(0)}%`
                      : "—"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-[#64748B]">Page view → review click</span>
                  <span className="font-semibold">
                    {data.conversionRates.pageViewToReviewClick != null
                      ? `${(data.conversionRates.pageViewToReviewClick * 100).toFixed(0)}%`
                      : "—"}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className={cn(qrUi.cardPad)}>
            <h2 className="text-sm font-bold text-[#0B1B32]">Recent activity</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-xs text-[#64748B]">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Event</th>
                    <th className="pb-2 pr-4">Provider</th>
                    <th className="pb-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((row) => (
                    <tr key={row.id} className="border-b border-[#F1F5F9]">
                      <td className="py-2 pr-4 text-[#64748B]">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 font-medium text-[#334155]">
                        {row.eventType.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 pr-4">
                        {row.provider ? PROVIDER_LABELS[row.provider] ?? row.provider : "—"}
                      </td>
                      <td className="py-2">
                        {row.amountSelectedCents
                          ? `$${(row.amountSelectedCents / 100).toFixed(2)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.recentActivity.length === 0 && (
                <p className="py-4 text-sm text-[#94A3B8]">No activity recorded yet.</p>
              )}
            </div>
          </div>
        </>
      )}
    </ModulePage>
  );
}
