"use client";

import { campaignUi } from "@/components/campaigns/broadcast/campaign-layout";
import { clearComposeDraft, loadComposeDraft } from "@/lib/campaigns/compose-draft";
import { formatRecurrenceSummary } from "@/lib/campaigns/recurrence-format";
import {
  fetchCampaignById,
  fetchLaunchReview,
  formatScheduledAt,
  isCampaignLaunchPending,
  launchCampaign,
  type LaunchReviewData,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const LAUNCHED_STATUSES = new Set(["SENDING", "SCHEDULED", "COMPLETED", "SENT"]);

function normalizeStatus(status: string): string {
  return status.toUpperCase().replace(/\s+/g, "_");
}

export function CampaignSuccessView() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const mode = searchParams.get("mode") || loadComposeDraft().scheduleMode;
  const draft = loadComposeDraft();
  const [summary, setSummary] = useState<{
    scheduledLabel: string;
    recipients: number;
    credits: number;
  } | null>(null);

  useEffect(() => {
    return () => clearComposeDraft();
  }, []);

  useEffect(() => {
    if (!campaignId || mode !== "later") return;
    let cancelled = false;
    void (async () => {
      try {
        const [campaign, review] = await Promise.all([
          fetchCampaignById(campaignId),
          fetchLaunchReview(campaignId),
        ]);
        if (cancelled) return;
        const tz = campaign?.timezone || draft.timezone || review.timezone;
        const scheduledLabel =
          campaign?.scheduledAt && tz
            ? formatScheduledAt(campaign.scheduledAt, tz).replace(/^Scheduled /, "")
            : draft.scheduledDate
              ? `${draft.scheduledDate} at ${draft.scheduledTime || ""} (${draft.timezone})`
              : "";
        setSummary({
          scheduledLabel,
          recipients: review.finalRecipientCount,
          credits: review.requiredSegments,
        });
      } catch {
        // Fall back to compose draft copy below.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, draft.scheduledDate, draft.scheduledTime, draft.timezone, mode]);

  const title =
    mode === "recurring"
      ? "Recurring Campaign Started!"
      : mode === "now"
        ? "Campaign Queued!"
        : "Campaign Scheduled!";
  const detail =
    mode === "later" && summary?.scheduledLabel
      ? `Your campaign is scheduled to send on ${summary.scheduledLabel}.`
      : mode === "later" && draft.scheduledDate
        ? `Your campaign is scheduled to send on ${draft.scheduledDate} at ${draft.scheduledTime || ""} (${draft.timezone}).`
        : mode === "recurring" && draft.recurrence
          ? formatRecurrenceSummary(draft.recurrence, draft.timezone)
          : mode === "recurring"
            ? "Your recurring campaign has been started."
            : "Your campaign has been queued for delivery.";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eef2ff]">
        <Send className="h-9 w-9 text-[#6366f1]" />
      </div>
      <h1 className="mt-6 text-[28px] font-bold text-[#111827]">{title}</h1>
      <p className="mt-2 max-w-md text-[15px] text-[#6b7280]">{detail}</p>
      {mode === "later" && summary ? (
        <p className="mt-3 max-w-md text-[13px] text-slate-600 tabular-nums">
          {formatNumber(summary.recipients)} recipients · {formatNumber(summary.credits)} credits reserved
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {campaignId ? (
          <Link href={`/campaigns/${campaignId}`} className={campaignUi.primaryBtn}>
            View Campaign
          </Link>
        ) : (
          <Link href="/campaigns" className={campaignUi.primaryBtn}>
            View Campaigns
          </Link>
        )}
        <Link href="/campaigns/new" className={campaignUi.outlineBtn} onClick={() => clearComposeDraft()}>
          Create Another
        </Link>
      </div>
    </div>
  );
}

export function CampaignQueueView() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const [seconds, setSeconds] = useState(3);
  const [launching, setLaunching] = useState(false);
  const [loadingReview, setLoadingReview] = useState(true);
  const [review, setReview] = useState<LaunchReviewData | null>(null);
  const [confirmLargeSend, setConfirmLargeSend] = useState(false);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState("");
  const inFlightRef = useRef(false);
  const cancelledRef = useRef(false);
  const router = useRouter();

  const recipientCount = review?.finalRecipientCount ?? 0;
  const requiredCredits = review?.requiredSegments ?? 0;
  const requiresLargeConfirm = recipientCount >= 1000;

  const redirectToDetail = useCallback(() => {
    if (!campaignId) return;
    clearComposeDraft();
    router.replace(`/campaigns/${campaignId}`);
  }, [campaignId, router]);

  useEffect(() => {
    if (!campaignId) {
      setLoadingReview(false);
      return;
    }

    const id = campaignId;
    let cancelled = false;

    async function bootstrap() {
      setLoadingReview(true);
      setError("");
      try {
        const [campaign, launchReview] = await Promise.all([
          fetchCampaignById(id),
          fetchLaunchReview(id),
        ]);
        if (cancelled) return;

        const status = normalizeStatus(campaign?.status || "DRAFT");
        if (LAUNCHED_STATUSES.has(status)) {
          redirectToDetail();
          return;
        }

        setReview(launchReview);
        if (launchReview.finalRecipientCount < 1000) {
          setArmed(true);
        }

        if (isCampaignLaunchPending(id) && status === "DRAFT") {
          setSeconds(0);
          setArmed(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load launch review");
        }
      } finally {
        if (!cancelled) setLoadingReview(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [campaignId, redirectToDetail]);

  const runLaunch = useCallback(async () => {
    if (!campaignId || inFlightRef.current) return;
    if (requiresLargeConfirm && !confirmLargeSend) {
      setError("Confirm the large-send checkbox before launching.");
      return;
    }
    inFlightRef.current = true;
    setLaunching(true);
    setError("");
    try {
      await launchCampaign(campaignId, recipientCount, confirmLargeSend);
      redirectToDetail();
    } catch (err) {
      inFlightRef.current = false;
      setError(err instanceof Error ? err.message : "Could not launch campaign");
    } finally {
      setLaunching(false);
    }
  }, [campaignId, confirmLargeSend, recipientCount, redirectToDetail, requiresLargeConfirm]);

  useEffect(() => {
    if (!campaignId || cancelledRef.current || !armed || loadingReview) return;
    if (requiresLargeConfirm) return;
    if (seconds > 0) {
      const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }

    void runLaunch();
  }, [seconds, campaignId, armed, requiresLargeConfirm, loadingReview, runLaunch]);

  async function cancelSend() {
    if (inFlightRef.current || launching) return;
    cancelledRef.current = true;
    if (campaignId) {
      const res = await fetch(`/api/mass-texting/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || "Could not cancel campaign");
        cancelledRef.current = false;
        return;
      }
    }
    clearComposeDraft();
    router.push("/campaigns");
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#6366f1"
            strokeWidth="6"
            strokeDasharray={`${(seconds / 3) * 283} 283`}
          />
        </svg>
        <span className="text-[48px] font-bold text-[#6366f1]">
          {launching ? <Loader2 className="h-10 w-10 animate-spin" /> : seconds}
        </span>
      </div>
      <h1 className="mt-8 text-[22px] font-bold text-[#111827]">
        {launching ? "Launching campaign…" : "Confirm send"}
      </h1>
      <p className="mt-2 text-[14px] text-[#6b7280]">
        {loadingReview
          ? "Loading launch review…"
          : launching
            ? "Sending messages to your audience."
            : requiresLargeConfirm
              ? "Confirm the recipient count and credits before launch."
              : `You can cancel for ${seconds} seconds.`}
      </p>
      {review && !loadingReview ? (
        <div className="mt-4 max-w-md rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-left text-[13px] text-slate-700">
          <p className="font-semibold text-slate-900">{review.campaignName || "Campaign"}</p>
          <p className="mt-1 tabular-nums">
            <span className="font-medium">{formatNumber(review.finalRecipientCount)}</span> recipients
            {" · "}
            <span className="font-medium">{formatNumber(review.requiredSegments)}</span> credits required
          </p>
          {review.availableSegments < review.requiredSegments ? (
            <p className="mt-1 text-red-700">
              Insufficient credits ({formatNumber(review.availableSegments)} available).
            </p>
          ) : null}
        </div>
      ) : null}
      {requiresLargeConfirm && !launching ? (
        <label className="mt-4 flex max-w-md items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left text-[13px] text-amber-900">
          <input
            type="checkbox"
            checked={confirmLargeSend}
            onChange={(e) => setConfirmLargeSend(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I confirm sending to {formatNumber(recipientCount)} recipients ({formatNumber(requiredCredits)}{" "}
            credits).
          </span>
        </label>
      ) : null}
      {error ? (
        <p className="mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      {!launching ? (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => void cancelSend()} className={cn(campaignUi.outlineBtn)}>
            Cancel Send
          </button>
          {requiresLargeConfirm ? (
            <button
              type="button"
              disabled={loadingReview || !confirmLargeSend || inFlightRef.current}
              onClick={() => void runLaunch()}
              className={campaignUi.primaryBtn}
            >
              Launch Campaign
            </button>
          ) : error ? (
            <button
              type="button"
              disabled={inFlightRef.current}
              onClick={() => void runLaunch()}
              className={campaignUi.primaryBtn}
            >
              Try Again
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
