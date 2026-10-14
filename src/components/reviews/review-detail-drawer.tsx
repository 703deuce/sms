"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import {
  BusinessCell,
  ReviewStatusBadge,
  ReviewerAvatar,
  SourceIcon,
  StarRating,
  TagPills,
} from "@/components/reviews/reviews-ui";
import { HighlightedReviewText } from "@/components/reviews/highlighted-review-text";

function readableOwnerResponse(text: string | null): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { response_from_owner_string?: string };
      const reply = parsed.response_from_owner_string?.trim();
      return reply || null;
    } catch {
      return null;
    }
  }
  return trimmed;
}

export function ReviewDetailDrawer({
  review,
  highlightPhrases = [],
  businessId,
  onClose,
  onUpdated,
}: {
  review: ReviewListItem | null;
  highlightPhrases?: string[];
  businessId?: string;
  onClose: () => void;
  onUpdated?: (review: ReviewListItem) => void;
}) {
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft("");
    setStatusMsg(null);
    setError(null);
  }, [review?.id]);

  if (!review) return null;
  const currentReview = review;

  const dateLabel = currentReview.publishedAt || currentReview.reviewDate
    ? new Date(currentReview.publishedAt ?? currentReview.reviewDate!).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: currentReview.publishedAt ? "numeric" : undefined,
        minute: currentReview.publishedAt ? "2-digit" : undefined,
      })
    : null;

  const ownerReply = readableOwnerResponse(currentReview.ownerResponseText);

  async function generateReply() {
    if (!businessId) return;
    setGenerating(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/reputation/responses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reviewIds: [currentReview.id] }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        drafts?: Array<{ draftText?: string; reply?: string }>;
        reply?: string;
        error?: string;
      };
      const fromDrafts = json.drafts?.[0]?.draftText || json.drafts?.[0]?.reply;
      const reply = fromDrafts || json.reply;
      if (!res.ok || !reply) {
        const firstName = currentReview.reviewerName.split(" ")[0] || "there";
        setDraft(
          `Hi ${firstName},\n\nThank you for sharing your feedback. We appreciate you taking the time to review us and want to make sure we address anything that matters.\n\nBest regards`
        );
        setStatusMsg("Suggested reply ready (fallback)");
        return;
      }
      setDraft(reply);
      setStatusMsg("Suggested reply ready — copy into Google Business Profile to publish");
    } catch {
      setError("Could not generate a reply");
    } finally {
      setGenerating(false);
    }
  }

  async function toggleResolved() {
    if (!businessId) return;
    setResolving(true);
    setError(null);
    try {
      const nextResolved = !currentReview.resolved;
      const res = await fetch(`/api/reviews/${businessId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: currentReview.id, resolved: nextResolved }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      onUpdated?.({
        ...currentReview,
        resolved: nextResolved,
        resolvedAt: nextResolved ? json.review?.resolved_at ?? new Date().toISOString() : null,
      });
      setStatusMsg(nextResolved ? "Marked resolved" : "Reopened");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose} role="presentation">
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Review details"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <ReviewerAvatar name={review.reviewerName} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-zinc-900">{review.reviewerName}</p>
                {review.isNew ? (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
                    New
                  </span>
                ) : null}
              </div>
              {!review.isTarget && <p className="text-sm text-zinc-500">{review.businessName}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StarRating rating={review.rating} size="md" />
                <ReviewStatusBadge replied={review.replied} variant="pill" />
                {review.resolved ? (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                    Resolved
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100" aria-label="Close">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600">
            {!review.isTarget && <BusinessCell row={review} />}
            <div className="flex items-center gap-2">
              <SourceIcon source={review.source} />
              <span className="capitalize">{review.source}</span>
            </div>
            {dateLabel && (
              <div>
                <p className="font-medium text-zinc-900">{dateLabel}</p>
                {review.relativeDate && <p className="text-xs text-zinc-500">{review.relativeDate}</p>}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Full review</p>
            {highlightPhrases.length > 0 ? (
              <div className="mt-3">
                <HighlightedReviewText
                  text={review.reviewText}
                  phrases={highlightPhrases}
                  className="text-base text-zinc-800"
                />
              </div>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-zinc-800">
                {review.reviewText?.trim() || "No review text provided."}
              </p>
            )}
          </div>

          {review.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Keywords</p>
              <div className="mt-2">
                <TagPills tags={review.tags} />
              </div>
            </div>
          )}

          {ownerReply && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Your reply</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{ownerReply}</p>
            </div>
          )}

          {review.isTarget && businessId ? (
            <div className="space-y-2 rounded-lg border border-zinc-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Generate response</p>
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => void generateReply()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0f6344] disabled:opacity-60"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {generating ? "Generating…" : "Generate"}
                </button>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder="Generated reply appears here. Copy into Google Business Profile to publish — we do not auto-post."
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-[#137752]"
              />
              {draft ? (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(draft);
                    setStatusMsg("Copied to clipboard");
                  }}
                  className="text-[12px] font-semibold text-[#137752] hover:underline"
                >
                  Copy reply
                </button>
              ) : null}
            </div>
          ) : null}

          {statusMsg ? (
            <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              {statusMsg}
            </p>
          ) : null}
          {error ? <p className="text-[12px] font-medium text-red-600">{error}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-zinc-200 px-6 py-4">
          {review.isTarget && businessId ? (
            <button
              type="button"
              disabled={resolving}
              onClick={() => void toggleResolved()}
              className="rounded-full bg-[#137752] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f6344] disabled:opacity-60"
            >
              {resolving ? "Saving…" : review.resolved ? "Reopen" : "Mark resolved"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
