"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  BarChart3,
  Copy,
  ExternalLink,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { ReviewsOpusPage } from "@/newui-transplant/connected/reviews/reviews-opus-page";
import { QrKpiCard, QrStatusBadge, qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

export function PaymentQrCampaignEditor({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const base = `/businesses/${businessId}/reputation/qr-campaigns`;
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<ReviewQrCampaign | null>(null);
  const [trackedUrl, setTrackedUrl] = useState("");
  const [publicPageUrl, setPublicPageUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campaignRes, configRes] = await Promise.all([
        fetch(`/api/reputation/qr-campaigns/${campaignId}?businessId=${businessId}`),
        fetch(`/api/reputation/payment-qr?businessId=${businessId}&campaignId=${campaignId}`),
      ]);
      const campaignJson = (await campaignRes.json()) as {
        campaign?: ReviewQrCampaign;
        trackedUrl?: string;
      };
      const configJson = (await configRes.json()) as {
        publicPageUrl?: string;
      };

      if (campaignJson.campaign) {
        setCampaign(campaignJson.campaign);
        setTrackedUrl(campaignJson.trackedUrl ?? "");
        const slug = campaignJson.campaign.publicSlug ?? campaignJson.campaign.shortCode;
        const pageUrl =
          configJson.publicPageUrl ??
          `""/p/${slug}`;
        setPublicPageUrl(pageUrl);
        const qr = await QRCode.toDataURL(pageUrl, {
          width: 400,
          margin: 1,
          color: { dark: "#0B1B32", light: "#ffffff" },
        });
        setQrDataUrl(qr);
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus() {
    if (!campaign) return;
    setBusy(true);
    try {
      const next = campaign.status === "active" ? "paused" : "active";
      await fetch(`/api/reputation/qr-campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, patch: { status: next } }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-sm text-red-600">Campaign not found.</p>;
  }

  return (
    <ReviewsOpusPage className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={base} className="text-sm font-medium text-[#64748B] hover:text-[#0B1B32]">
            ← All campaigns
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className={qrUi.title}>{campaign.name}</h1>
            <QrStatusBadge status={campaign.status} />
            <span className="rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-xs font-bold text-[#1D4ED8]">
              Pay &amp; Review Page
            </span>
          </div>
          <p className="mt-2 text-sm text-[#64748B]">
            One hosted page for payment links, reviews, and social connections.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/${campaignId}/analytics`}
            className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
          >
            <BarChart3 className="h-4 w-4" /> Analytics
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleStatus()}
            className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
          >
            {campaign.status === "active" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {campaign.status === "active" ? "Pause" : "Activate"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <QrKpiCard label="QR scans" value={String(campaign.totalScans)} />
        <QrKpiCard label="Est. unique" value={String(campaign.estimatedUniqueScans)} />
        <QrKpiCard label="Short code" value={campaign.shortCode} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={cn(qrUi.cardPad, "space-y-4")}>
          <h2 className="text-sm font-bold text-[#0B1B32]">Shareable page link</h2>
          <p className="text-sm text-[#64748B] break-all">{publicPageUrl}</p>
          <p className="text-xs text-[#94A3B8]">
            QR code points to this hosted page — not directly to Stripe, Venmo, or Cash App.
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(publicPageUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={cn(qrUi.btnSecondary, "inline-flex items-center gap-2")}
          >
            <Copy className="h-4 w-4" />
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={publicPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(qrUi.btnPrimary, "inline-flex items-center gap-2 bg-[#2563EB]")}
          >
            <ExternalLink className="h-4 w-4" /> View page
          </a>
        </div>

        <div className={cn(qrUi.cardPad, "flex flex-col items-center")}>
          <h2 className="text-sm font-bold text-[#0B1B32]">Page QR code</h2>
          {qrDataUrl && (
            <img src={qrDataUrl} alt="QR code" className="mt-4 h-48 w-48 rounded-xl border" />
          )}
          <p className="mt-3 text-xs text-[#64748B]">Tracked scan URL: {trackedUrl}</p>
        </div>
      </div>
    </ReviewsOpusPage>
  );
}
