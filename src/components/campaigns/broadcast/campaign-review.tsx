"use client";

import {
  CampaignPageShell,
  campaignUi,
} from "@/components/campaigns/broadcast/campaign-layout";
import { PhonePreview } from "@/components/campaigns/broadcast/phone-preview";
import { loadComposeDraft } from "@/lib/campaigns/compose-draft";
import { cn, formatNumber, formatPhone } from "@/lib/utils";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type LaunchReview = {
  campaignId: string;
  campaignName: string;
  listNames: string[];
  finalRecipientCount: number;
  estimatedSegments: number;
  availableSegments: number;
  requiredSegments: number;
  shortage: number;
  canSend: boolean;
  blockReason: string | null;
  phoneE164: string | null;
  scheduledAt: string | null;
};

export function CampaignReviewView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id") || loadComposeDraft().campaignId;
  const draft = loadComposeDraft();
  const [review, setReview] = useState<LaunchReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  const loadReview = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch-review`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load review");
      setReview(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load review");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  async function launch() {
    if (!campaignId || !review?.canSend) return;
    setLaunching(true);
    setError("");
    try {
      const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmLargeSend: review.finalRecipientCount >= 1000 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Launch failed");

      if (draft.scheduleMode === "now") {
        router.push(`/campaigns/new/queue?id=${campaignId}`);
      } else {
        router.push(
          `/campaigns/new/success?id=${campaignId}&mode=${draft.scheduleMode}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  const timingLabel =
    draft.scheduleMode === "now"
      ? "Send Immediately"
      : draft.scheduleMode === "later" && draft.scheduledDate
        ? `${draft.scheduledDate} at ${draft.scheduledTime || ""} ${draft.timezone}`
        : draft.scheduleMode === "recurring"
          ? "Recurring campaign"
          : "Scheduled";

  const actionLabel =
    draft.scheduleMode === "now"
      ? "Send Now"
      : draft.scheduleMode === "recurring"
        ? "Start Recurring Campaign"
        : "Schedule Campaign";

  return (
    <CampaignPageShell
      title="Review Details"
      breadcrumb={
        <>
          <Link href="/campaigns" className="hover:text-[#6366f1]">
            Campaigns
          </Link>
          <span className="mx-2">/</span>
          <Link href="/campaigns/new" className="hover:text-[#6366f1]">
            Create Campaign
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#111827]">Review</span>
        </>
      }
      right={
        <PhonePreview
          message={draft.message}
          senderLabel={draft.senderLabel || review?.phoneE164 || undefined}
        />
      }
    >
      <div className="space-y-4">
        <ReviewSection
          title="Audience"
          editHref="/campaigns/new"
          loading={loading}
        >
          <p className="text-[14px] font-medium text-[#111827]">
            {review?.listNames?.join(", ") || draft.audience.map((a) => a.name).join(", ") || "—"}
          </p>
          <p className="mt-1 text-[13px] text-[#059669]">
            {formatNumber(review?.finalRecipientCount ?? 0)} eligible contacts
          </p>
        </ReviewSection>

        <ReviewSection title="Timing" editHref="/campaigns/new" loading={loading}>
          <p className="text-[14px] font-medium text-[#111827]">{timingLabel}</p>
        </ReviewSection>

        <ReviewSection title="Message" editHref="/campaigns/new" loading={loading}>
          <p className="whitespace-pre-wrap text-[13px] text-[#374151]">
            {draft.message || "—"}
          </p>
          {draft.senderLabel || review?.phoneE164 ? (
            <p className="mt-2 text-[12px] text-[#6b7280]">
              From: {formatPhone(draft.senderLabel || review?.phoneE164 || "")}
            </p>
          ) : null}
        </ReviewSection>

        <div className={cn(campaignUi.card, "p-5")}>
          <h3 className="text-[15px] font-semibold text-[#111827]">Send summary</h3>
          {loading ? (
            <p className="mt-3 text-[13px] text-[#6b7280]">Calculating…</p>
          ) : review ? (
            <dl className="mt-4 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Recipients</dt>
                <dd className="font-semibold tabular-nums">
                  {formatNumber(review.finalRecipientCount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#6b7280]">Estimated messages</dt>
                <dd className="font-semibold tabular-nums">
                  {formatNumber(review.estimatedSegments)}
                </dd>
              </div>
              {review.finalRecipientCount > 0 &&
              review.estimatedSegments > review.finalRecipientCount ? (
                <p className="pt-1 text-[12px] text-[#6b7280]">
                  Personalized messages may use more than one SMS segment per recipient.
                </p>
              ) : null}
            </dl>
          ) : null}
          {review && !review.canSend && review.blockReason ? (
            <p className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-[13px] text-[#b91c1c]">
              {review.blockReason}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-[13px] text-[#dc2626]">{error}</p> : null}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/campaigns/new" className={campaignUi.outlineBtn}>
            Back
          </Link>
          <button
            type="button"
            disabled={launching || loading || !review?.canSend}
            onClick={() => void launch()}
            className={campaignUi.primaryBtn}
          >
            {launching ? "Processing…" : actionLabel}
          </button>
        </div>
      </div>
    </CampaignPageShell>
  );
}

function ReviewSection({
  title,
  editHref,
  loading,
  children,
}: {
  title: string;
  editHref: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(campaignUi.card, "p-5")}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
        <Link href={editHref} className={campaignUi.ghostBtn}>
          Edit
        </Link>
      </div>
      {loading ? <p className="text-[13px] text-[#6b7280]">Loading…</p> : children}
    </div>
  );
}
