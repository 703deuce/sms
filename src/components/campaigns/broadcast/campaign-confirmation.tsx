"use client";

import { campaignUi } from "@/components/campaigns/broadcast/campaign-layout";
import { clearComposeDraft, loadComposeDraft } from "@/lib/campaigns/compose-draft";
import { formatRecurrenceSummary } from "@/lib/campaigns/recurrence-format";
import {
  fetchLaunchReview,
  launchCampaign,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { cn } from "@/lib/utils";
import { Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function CampaignSuccessView() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const mode = searchParams.get("mode") || loadComposeDraft().scheduleMode;
  const draft = loadComposeDraft();

  useEffect(() => {
    return () => clearComposeDraft();
  }, []);

  const title =
    mode === "recurring"
      ? "Recurring Campaign Started!"
      : mode === "now"
        ? "Campaign Queued!"
        : "Campaign Scheduled!";
  const detail =
    mode === "later" && draft.scheduledDate
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
  const [error, setError] = useState("");
  const launchedRef = useRef(false);
  const cancelledRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!campaignId || cancelledRef.current || launchedRef.current) return;
    if (seconds > 0) {
      const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
      return () => clearTimeout(t);
    }

    launchedRef.current = true;
    setLaunching(true);
    setError("");
    void (async () => {
      try {
        const review = await fetchLaunchReview(campaignId);
        await launchCampaign(campaignId, review.finalRecipientCount);
        clearComposeDraft();
        router.push(`/campaigns/${campaignId}`);
      } catch (err) {
        launchedRef.current = false;
        setError(err instanceof Error ? err.message : "Could not launch campaign");
      } finally {
        setLaunching(false);
      }
    })();
  }, [seconds, campaignId, router]);

  async function cancelSend() {
    if (launchedRef.current || launching) return;
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
        {launching ? "Launching campaign…" : "Campaign is being queued…"}
      </h1>
      <p className="mt-2 text-[14px] text-[#6b7280]">
        {launching
          ? "Sending messages to your audience."
          : `You can cancel for ${seconds} seconds.`}
      </p>
      {error ? (
        <p className="mt-4 max-w-md rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      {!launching ? (
        <button type="button" onClick={() => void cancelSend()} className={cn(campaignUi.outlineBtn, "mt-6")}>
          Cancel Send
        </button>
      ) : null}
    </div>
  );
}
