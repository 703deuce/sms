"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ChevronLeft, ChevronDown, Loader2 } from "lucide-react";
import PhonePreview from "./PhonePreview";
import {
  composeMessageBody,
  loadComposeDraft,
  saveComposeDraft,
  type CampaignComposeDraft,
} from "@/lib/campaigns/compose-draft";
import { formatNumber } from "@/lib/utils";
import {
  fetchLaunchReview,
  launchCampaign,
  saveCampaignDraft,
  timingLabel,
  type LaunchReviewData,
} from "@/lib/campaigns/kimi-campaigns-adapter";

export default function ReviewDetails({
  onPrev,
}: {
  onPrev: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id") || loadComposeDraft().campaignId;
  const [draft, setDraft] = useState<CampaignComposeDraft>(loadComposeDraft());
  const [review, setReview] = useState<LaunchReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const loadReview = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchLaunchReview(campaignId);
      setReview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load review");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    const loaded = loadComposeDraft();
    setDraft(loaded);
    if (campaignId && campaignId !== loaded.campaignId) {
      saveComposeDraft({ ...loaded, campaignId });
    }
    void loadReview();
  }, [campaignId, loadReview]);

  async function handleSaveDraft() {
    try {
      await saveCampaignDraft({ ...draft, campaignId: campaignId || draft.campaignId });
      router.push("/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft");
    }
  }

  async function handleSend() {
    if (!campaignId || !review?.canSend) return;
    setLaunching(true);
    setError("");
    try {
      await launchCampaign(campaignId, review.finalRecipientCount);
      if (draft.scheduleMode === "now") {
        router.push(`/campaigns/new/queue?id=${campaignId}`);
      } else {
        router.push(`/campaigns/new/success?id=${campaignId}&mode=${draft.scheduleMode}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  const actionLabel =
    draft.scheduleMode === "now"
      ? "Send Now"
      : draft.scheduleMode === "recurring"
        ? "Start Recurring Campaign"
        : "Schedule Campaign";

  const previewBody = composeMessageBody(draft.message);

  if (!campaignId) {
    return (
      <div className="flex-1 min-h-screen bg-[#f6f7fb] px-10 py-8">
        <p className="text-[13px] text-red-600">No campaign to review. Go back and save your draft first.</p>
        <button type="button" onClick={onPrev} className="btn-ghost mt-4">Back</button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb] px-10 py-8">
      <p className="text-[12px] text-slate-400">
        Campaigns <span className="mx-1 text-slate-300">/</span> <span className="text-slate-600 font-medium">Create Campaign</span>
      </p>
      <div className="grid grid-cols-[1fr_360px] gap-14 mt-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Review Details</h1>
          <p className="text-sm text-slate-500 mt-1.5">Confirm your campaign details.</p>

          <div className="mt-8 max-w-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">
                Audience{" "}
                <span className="ml-1 align-middle text-[10.5px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5">
                  Subscribed Contacts Only
                </span>
              </h3>
              <button type="button" onClick={onPrev} className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Edit</button>
            </div>
            <div className="review-card mt-3 flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="space-y-0.5">
                  {(review?.listNames?.length ? review.listNames : draft.audience.map((a) => a.name)).map((a) => (
                    <p key={a} className="text-[13px] font-medium text-slate-700">{a}</p>
                  ))}
                </div>
              </div>
              <span className="text-[20px] font-bold tracking-tight text-slate-900 tabular-nums">
                {loading ? "…" : formatNumber(review?.finalRecipientCount ?? 0)}
              </span>
            </div>
          </div>

          <div className="mt-7 max-w-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">Timing</h3>
              <button type="button" onClick={onPrev} className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Edit</button>
            </div>
            <div className="review-card mt-3 px-5 py-4 text-[13px] font-medium text-slate-700">{timingLabel(draft)}</div>
          </div>

          <div className="mt-7 max-w-xl">
            <h3 className="text-[15px] font-bold text-slate-900">Message Credit Summary</h3>
            <div className="review-card mt-3 divide-y divide-slate-100">
              {loading ? (
                <div className="px-5 py-4 text-[13px] text-slate-500">Calculating…</div>
              ) : review ? (
                [
                  ["Credits Available", formatNumber(review.availableSegments)],
                  ["Credits Required", formatNumber(review.requiredSegments)],
                  ["Credits Remaining", formatNumber(Math.max(0, review.availableSegments - review.requiredSegments))],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-[13px] text-slate-500">{k}</span>
                    <span className={`text-[14px] font-semibold tabular-nums ${k === "Credits Remaining" && review.shortage > 0 ? "text-red-600" : "text-slate-900"}`}>{v}</span>
                  </div>
                ))
              ) : null}
            </div>
            {review && !review.canSend && review.blockReason ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{review.blockReason}</p>
            ) : null}
          </div>

          {error ? <p className="mt-4 text-[13px] text-red-600">{error}</p> : null}

          <div className="flex items-center justify-between max-w-xl mt-10">
            <button type="button" onClick={onPrev} className="btn-ghost flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Prev</button>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => void handleSaveDraft()} className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">Save Draft</button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={launching || loading || !review?.canSend}
                className="btn-primary flex items-center gap-1.5 !py-2.5 disabled:opacity-60"
              >
                {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {actionLabel} <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <PhonePreview message={previewBody} label="Campaign Preview" />
      </div>
    </div>
  );
}
