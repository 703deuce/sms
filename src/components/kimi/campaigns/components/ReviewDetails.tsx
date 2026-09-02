"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ChevronLeft, Loader2, CalendarClock, Wallet } from "lucide-react";
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
  type ReviewNavPaths,
} from "@/lib/campaigns/kimi-campaigns-adapter";

export default function ReviewDetails({
  onPrev,
  paths,
}: {
  onPrev: (campaignId?: string) => void;
  paths?: ReviewNavPaths;
}) {
  const router = useRouter();
  const homePath = paths?.homePath ?? "/campaigns";
  const queuePath = paths?.queuePath ?? ((id: string) => `/campaigns/new/queue?id=${id}`);
  const successPath =
    paths?.successPath ?? ((id: string, mode: string) => `/campaigns/new/success?id=${id}&mode=${mode}`);
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id") || loadComposeDraft().campaignId;
  const [draft, setDraft] = useState<CampaignComposeDraft>(loadComposeDraft());
  const [review, setReview] = useState<LaunchReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [confirmLargeSend, setConfirmLargeSend] = useState(false);

  const loadReview = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchLaunchReview(campaignId);
      setReview(data);
      setDraft((prev) => {
        if (prev.scheduleMode === "recurring") return prev;
        if (!data.scheduledAt) return prev;
        const when = new Date(data.scheduledAt);
        if (Number.isNaN(when.getTime())) return prev;
        return {
          ...prev,
          scheduleMode: "later",
          scheduledDate: when.toISOString().slice(0, 10),
          scheduledTime: when.toTimeString().slice(0, 5),
        };
      });
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
      router.push(homePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft");
    }
  }

  async function handleSend() {
    if (!campaignId || !review?.canSend) return;
    if (review.finalRecipientCount >= 1000 && !confirmLargeSend) {
      setError("Confirm the large send checkbox before launching.");
      return;
    }
    setLaunching(true);
    setError("");
    try {
      if (draft.scheduleMode === "now") {
        router.push(queuePath(campaignId));
        return;
      }
      await launchCampaign(campaignId, review.finalRecipientCount, confirmLargeSend);
      router.push(successPath(campaignId, draft.scheduleMode));
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
        <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-[13px] font-medium text-red-700">No campaign to review. Go back and save your draft first.</p>
          <button type="button" onClick={() => onPrev()} className="btn-ghost mt-3">Back</button>
        </div>
      </div>
    );
  }

  const sectionCard =
    "rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

  return (
    <div className="flex-1 min-h-screen bg-[#f6f7fb] px-10 py-8">
      <p className="text-[12px] font-medium text-slate-400">
        Campaigns <span className="mx-1.5 text-slate-300">/</span>{" "}
        <span className="font-semibold text-slate-600">Create Campaign</span>
      </p>
      <div className="mt-4 grid grid-cols-[1fr_360px] gap-14">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Review Details</h1>
          <p className="mt-1.5 text-sm text-slate-500">Confirm your campaign details.</p>

          <div className="mt-8 max-w-xl">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
                Audience
                <span className="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-indigo-600">
                  Subscribed Contacts Only
                </span>
              </h3>
              <button
                type="button"
                onClick={() => onPrev(campaignId)}
                className="rounded-md px-2 py-1 text-[13px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
              >
                Edit
              </button>
            </div>
            <div className={`${sectionCard} mt-3 flex items-center justify-between px-5 py-4`}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 ring-1 ring-indigo-200/60">
                  <Users className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  {(review?.listNames?.length ? review.listNames : draft.audience.map((a) => a.name)).map((a, i) => (
                    <p key={`${a}-${i}`} className="truncate text-[13px] font-medium text-slate-700">{a}</p>
                  ))}
                </div>
              </div>
              <span className="ml-4 shrink-0 text-[20px] font-bold tabular-nums tracking-tight text-slate-900">
                {loading ? "…" : formatNumber(review?.finalRecipientCount ?? 0)}
              </span>
            </div>
          </div>

          <div className="mt-7 max-w-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">Timing</h3>
              <button
                type="button"
                onClick={() => onPrev(campaignId)}
                className="rounded-md px-2 py-1 text-[13px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
              >
                Edit
              </button>
            </div>
            <div className={`${sectionCard} mt-3 flex items-center gap-3 px-5 py-4 text-[13px] font-medium text-slate-700`}>
              <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
              {timingLabel(draft)}
            </div>
          </div>

          <div className="mt-7 max-w-xl">
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <Wallet className="h-4 w-4 text-slate-400" /> Message Credit Summary
            </h3>
            <div className={`${sectionCard} mt-3 divide-y divide-slate-100`}>
              {loading ? (
                <div className="flex items-center gap-2 px-5 py-4 text-[13px] text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> Calculating…
                </div>
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
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] leading-relaxed text-red-700">
                {review.blockReason}
              </p>
            ) : null}
            {review && review.finalRecipientCount >= 1000 ? (
              <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                <input
                  type="checkbox"
                  checked={confirmLargeSend}
                  onChange={(e) => setConfirmLargeSend(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  I confirm sending to {formatNumber(review.finalRecipientCount)} recipients
                  ({formatNumber(review.requiredSegments)} credits required).
                </span>
              </label>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 max-w-xl rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">{error}</p>
          ) : null}

          <div className="mt-10 flex max-w-xl items-center justify-between border-t border-slate-200/80 pt-5">
            <button type="button" onClick={() => onPrev(campaignId)} className="btn-ghost flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                className="text-[13px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={
                  launching ||
                  loading ||
                  !review?.canSend ||
                  (review.finalRecipientCount >= 1000 && !confirmLargeSend)
                }
                className="btn-primary flex items-center gap-1.5 !py-2.5 shadow-sm disabled:opacity-60"
              >
                {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {actionLabel}
              </button>
            </div>
          </div>
        </div>

        <PhonePreview message={previewBody} label="Campaign Preview" mediaUrls={draft.mediaUrls} />
      </div>
    </div>
  );
}
