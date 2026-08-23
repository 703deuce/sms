"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Lightbulb, Pencil, Settings } from "lucide-react";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { mock } from "@/components/mockup/ui";
import { SourceIcon, StarRating, ReviewerAvatar } from "@/components/reviews/reviews-ui";

type Props = {
  data: ReviewsPageData;
  businessId: string;
};

export function ReviewsUnansweredTab({ data, businessId }: Props) {
  const unanswered = data.unanswered;
  const [sourceFilter, setSourceFilter] = useState<"all" | "google" | "facebook">("all");
  const [selectedId, setSelectedId] = useState<string | null>(unanswered[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return unanswered;
    return unanswered.filter((r) => r.source === sourceFilter);
  }, [unanswered, sourceFilter]);

  const selected: ReviewListItem | null =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (selected && !filtered.some((r) => r.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selected, selectedId]);

  useEffect(() => {
    setDraft("");
    setEditing(false);
  }, [selected?.id]);

  async function generateReply(review: ReviewListItem) {
    setGenerating(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/reputation/responses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          reviewIds: [review.id],
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        drafts?: Array<{ draftText?: string; reply?: string }>;
        reply?: string;
        error?: string;
      };
      if (res.ok) {
        const fromDrafts = json.drafts?.[0]?.draftText || json.drafts?.[0]?.reply;
        const reply = fromDrafts || json.reply;
        if (reply) {
          setDraft(reply);
          setStatusMsg("Suggested reply ready");
          return;
        }
      }

      const firstName = review.reviewerName.split(" ")[0] || "there";
      const biz = data.businessName || "our team";
      setDraft(
        `Dear ${firstName},\n\nThank you for your excellent review! We're glad you had a great experience with ${biz}. We truly appreciate your kind words and look forward to serving you again soon!\n\nBest regards,\n${biz}`
      );
      setStatusMsg("Suggested reply ready");
    } catch {
      const firstName = review.reviewerName.split(" ")[0] || "there";
      const biz = data.businessName || "our team";
      setDraft(
        `Dear ${firstName},\n\nThank you for your excellent review! We're glad you had a great experience with ${biz}. We truly appreciate your kind words and look forward to serving you again soon!\n\nBest regards,\n${biz}`
      );
      setStatusMsg("Suggested reply ready");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (selected && !draft && !generating) {
      void generateReply(selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const googleCount = unanswered.filter((r) => r.source === "google").length;
  const facebookCount = unanswered.filter((r) => r.source === "facebook").length;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <div className="flex items-center gap-4 border-b border-[#E6EAF0]">
          {(
            [
              ["all", `All (${unanswered.length})`],
              ["google", `Google (${googleCount})`],
              ["facebook", `Facebook (${facebookCount})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSourceFilter(id)}
              className={`border-b-2 px-1 pb-2.5 text-[13px] font-semibold transition-colors ${
                sourceFilter === id
                  ? "border-[#0F172A] text-[#0F172A]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={`${mock.card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#E6EAF0] bg-[#FAFBFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3">Review Link</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">AI Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#64748B]">
                      No unanswered reviews right now.
                    </td>
                  </tr>
                ) : (
                  filtered.map((review) => {
                    const active = selected?.id === review.id;
                    const text = review.reviewText ?? "";
                    return (
                      <tr
                        key={review.id}
                        onClick={() => setSelectedId(review.id)}
                        className={`cursor-pointer border-b border-[#EEF1F5] last:border-0 ${
                          active ? "bg-[#F0FDF4]" : "hover:bg-[#FAFBFC]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <SourceIcon source={review.source} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <ReviewerAvatar name={review.reviewerName} size="sm" />
                            <span className="font-semibold text-[#0F172A]">{review.reviewerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StarRating rating={review.rating} />
                        </td>
                        <td className="max-w-[220px] px-4 py-3 text-[#475569]">
                          <span className="line-clamp-2">{text || "No review text"}</span>
                          {text.length > 80 ? (
                            <span className="mt-0.5 block text-[11px] font-medium text-[#137752]">
                              Read more...
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-[#137752]">View review</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">
                          {review.reviewDate
                            ? new Date(review.reviewDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "2-digit",
                                year: "numeric",
                              })
                            : review.relativeDate ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(review.id);
                            }}
                            className="rounded-lg border border-[#FCA5A5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2]"
                          >
                            Reply
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <p className="text-[13px] text-[#92400E]">
            One more step to see more results. Connect your GMB / Facebook accounts to pull in live
            review feeds.
          </p>
          <Link
            href={`/businesses/${businessId}/settings`}
            className="shrink-0 rounded-lg border border-[#E6EAF0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            View linked accounts
          </Link>
        </div>
      </div>

      <aside className="space-y-4">
        <div className={`${mock.card} p-4`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[#F59E0B]" />
              <h3 className="text-[14px] font-bold text-[#0F172A]">Suggested reply</h3>
            </div>
            <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[#B45309]">
              Unanswered
            </span>
          </div>

          {selected ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-[#E6EAF0] bg-[#FAFBFC] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[#0F172A]">{selected.reviewerName}</p>
                  <StarRating rating={selected.rating} />
                </div>
                <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-[#64748B]">
                  {selected.reviewText || "No review text"}
                </p>
              </div>

              <div className="rounded-lg border border-[#A7F3D0] bg-[#F0FDF4] p-3">
                {editing ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={6}
                    className="w-full resize-y rounded-md border border-[#E6EAF0] bg-white px-2.5 py-2 text-[12px] leading-relaxed text-[#0F172A] outline-none focus:border-[#137752]"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#14532D]">
                    {generating ? "Generating suggested reply…" : draft || "No suggestion yet."}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={`${mock.btnPrimary} flex-1`}
                  disabled={!draft}
                  onClick={async () => {
                    await navigator.clipboard.writeText(draft);
                    setStatusMsg("Reply copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy reply
                </button>
                <button
                  type="button"
                  className={`${mock.btnGhost} flex-1`}
                  onClick={() => setEditing((v) => !v)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {editing ? "Done" : "Edit reply"}
                </button>
              </div>
              {statusMsg ? (
                <p className="text-[11px] font-medium text-[#137752]">{statusMsg}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-[#64748B]">Select a review to draft a reply.</p>
          )}
        </div>

        <div className={`${mock.card} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[#0F172A]">Notifications</h3>
            <Settings className="h-4 w-4 text-[#94A3B8]" />
          </div>
          <div className="space-y-1">
            {["Reply to follow up on latest review", "Your Review Dashboard"].map((item) => (
              <button
                key={item}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-[13px] font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                <span>{item}</span>
                <span className="text-[#94A3B8]">›</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
