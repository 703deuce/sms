"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, ChevronLeft, Loader2, CalendarClock, Wallet, Phone, MessageSquare } from "lucide-react";
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
  formatLaunchReviewAudienceSummary,
  type LaunchReviewData,
  type ReviewNavPaths,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { zonedIsoToLocalDateTime } from "@/lib/campaigns/schedule-time";
import {
  CampaignButton,
  CampaignGhostButton,
  CampaignPageShell,
  CampaignReviewCard,
} from "@/components/campaigns/campaign-ui-primitives";

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
    if (!campaignId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchLaunchReview(campaignId);
      setReview(data);
      setDraft((prev) => {
        if (prev.scheduleMode === "recurring") return prev;
        if (!data.scheduledAt) return prev;
        const local = zonedIsoToLocalDateTime(data.scheduledAt, prev.timezone);
        if (!local.date) return prev;
        return {
          ...prev,
          scheduleMode: "later",
          scheduledDate: local.date,
          scheduledTime: local.time,
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
  const segmentsPerRecipient =
    review && review.finalRecipientCount > 0
      ? Math.max(1, Math.round(review.requiredSegments / review.finalRecipientCount))
      : null;
  const senderDisplay = review?.phoneE164 || draft.senderLabel || null;

  if (!campaignId) {
    return (
      <CampaignPageShell>
        <div className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4">
          <p className="text-[13px] font-medium text-destructive">
            No campaign to review. Go back and save your draft first.
          </p>
          <CampaignGhostButton type="button" className="mt-3" onClick={() => onPrev()}>
            Back
          </CampaignGhostButton>
        </div>
      </CampaignPageShell>
    );
  }

  return (
    <CampaignPageShell>
      <p className="text-[12px] text-muted-foreground">
        Campaigns / <span className="text-foreground">Create Campaign</span>
      </p>
      <div className="mt-4 grid grid-cols-1 gap-10 xl:grid-cols-[1fr_360px]">
        <div>
          <h1 className="text-[22px] font-bold text-foreground">Review Details</h1>
          <p className="mt-1 text-sm text-muted-foreground">Confirm your campaign details before sending.</p>

          <div className="mt-8 max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">
                Audience{" "}
                <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                  Subscribed contacts only
                </span>
              </h2>
              <button
                type="button"
                onClick={() => onPrev(campaignId)}
                className="text-[13px] font-semibold text-primary"
              >
                Edit
              </button>
            </div>
            <CampaignReviewCard className="mt-3 flex items-center justify-between px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                  <Users className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 space-y-0.5">
                  {(review?.listNames?.length ? review.listNames : draft.audience.map((a) => a.name)).map((a, i) => (
                    <p key={`${a}-${i}`} className="truncate text-[13px] font-medium text-foreground">{a}</p>
                  ))}
                </div>
              </div>
              <span className="ml-4 shrink-0 text-[20px] font-bold tabular-nums tracking-tight text-foreground">
                {loading ? "…" : formatNumber(review?.finalRecipientCount ?? 0)}
              </span>
            </CampaignReviewCard>
            {review && !loading ? (
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                {formatLaunchReviewAudienceSummary(review) ||
                  "Recipients are deduplicated across lists and exclude opted-out or invalid numbers."}
              </p>
            ) : null}
          </div>

          <div className="mt-7 max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">Sender</h2>
              <button
                type="button"
                onClick={() => onPrev(campaignId)}
                className="text-[13px] font-semibold text-primary"
              >
                Edit
              </button>
            </div>
            <CampaignReviewCard className="mt-3 flex items-center gap-3 px-5 py-4 text-[13px] font-medium text-foreground">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {loading ? "…" : senderDisplay || "No sender selected"}
            </CampaignReviewCard>
          </div>

          <div className="mt-7 max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">Message</h2>
              <button
                type="button"
                onClick={() => onPrev(campaignId)}
                className="text-[13px] font-semibold text-primary"
              >
                Edit
              </button>
            </div>
            <CampaignReviewCard className="mt-3 px-5 py-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                    {previewBody || "—"}
                  </p>
                  {loading ? null : (
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      {segmentsPerRecipient
                        ? `${segmentsPerRecipient} SMS segment${segmentsPerRecipient === 1 ? "" : "s"} per recipient`
                        : "Segment count unavailable"}
                      {review && review.estimatedSegments > 0
                        ? ` · ${formatNumber(review.estimatedSegments)} total segments`
                        : ""}
                    </p>
                  )}
                </div>
              </div>
            </CampaignReviewCard>
          </div>

          <div className="mt-7 max-w-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-foreground">Timing</h2>
              <button
                type="button"
                onClick={() => onPrev(campaignId)}
                className="text-[13px] font-semibold text-primary"
              >
                Edit
              </button>
            </div>
            <CampaignReviewCard className="mt-3 flex items-center gap-3 px-5 py-4 text-[13px] font-medium text-foreground">
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {timingLabel(draft)}
            </CampaignReviewCard>
          </div>

          <div className="mt-7 max-w-xl">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
              <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
              Message credit summary
            </h2>
            <CampaignReviewCard className="mt-3 divide-y divide-border">
              {loading ? (
                <div className="flex items-center gap-2 px-5 py-4 text-[13px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Calculating…
                </div>
              ) : review ? (
                [
                  ["Credits available", formatNumber(review.availableSegments)],
                  ["Credits required", formatNumber(review.requiredSegments)],
                  ["Credits remaining", formatNumber(Math.max(0, review.availableSegments - review.requiredSegments))],
                  ...(review.finalRecipientCount > 0
                    ? [
                        [
                          "Est. segments per recipient",
                          formatNumber(Math.max(1, Math.round(review.requiredSegments / review.finalRecipientCount))),
                        ],
                      ]
                    : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-[13px] text-muted-foreground">{k}</span>
                    <span
                      className={`text-[14px] font-semibold tabular-nums ${
                        k === "Credits remaining" && review.shortage > 0
                          ? "text-destructive"
                          : "text-foreground"
                      }`}
                    >
                      {v}
                    </span>
                  </div>
                ))
              ) : null}
            </CampaignReviewCard>
            {review && !review.canSend && review.blockReason ? (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive" role="alert">
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
            <p className="mt-4 max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-10 flex max-w-xl flex-wrap items-center justify-between gap-3">
            <CampaignGhostButton type="button" onClick={() => onPrev(campaignId)} className="gap-1">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </CampaignGhostButton>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveDraft()}
                className="text-[13px] font-semibold text-primary"
              >
                Save Draft
              </button>
              <CampaignButton
                type="button"
                onClick={() => void handleSend()}
                disabled={
                  launching ||
                  loading ||
                  !review?.canSend ||
                  (review.finalRecipientCount >= 1000 && !confirmLargeSend)
                }
                className="gap-1.5"
              >
                {launching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {actionLabel}
              </CampaignButton>
            </div>
          </div>
        </div>

        <PhonePreview message={previewBody} label="Campaign Preview" mediaUrls={draft.mediaUrls} />
      </div>
    </CampaignPageShell>
  );
}
