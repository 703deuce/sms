"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ImageIcon,
  RefreshCw,
  Rocket,
  ShieldAlert,
} from "lucide-react";
import { formatZonedScheduleLabel } from "@/lib/campaigns/schedule-time";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type LaunchReview = {
  campaignId: string;
  campaignName: string;
  listNames: string[];
  rawContactCount: number;
  duplicateRemoved: number;
  invalidRemoved: number;
  suppressedRemoved: number;
  finalRecipientCount: number;
  estimatedSegments: number;
  mmsCount: number;
  mediaUrls?: string[];
  phoneE164: string | null;
  scheduledAt: string | null;
  timezone: string | null;
  a2pUseCase: string;
  availableSegments: number;
  requiredSegments: number;
  shortage: number;
  canSend: boolean;
  blockReason: string | null;
};

function ReviewRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="shrink-0 text-[12px] text-amber-900/70">{label}</dt>
      <dd
        className={cn(
          "truncate text-right text-[13px] tabular-nums text-amber-950",
          strong ? "font-semibold" : "font-medium",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function CampaignLaunchReview({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const router = useRouter();
  const normalized = status.toUpperCase();
  const canLaunch = normalized === "DRAFT" || normalized === "SCHEDULED" || normalized === "PAUSED";
  const [review, setReview] = useState<LaunchReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const loadReview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch-review`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load launch review");
      setReview(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load launch review");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (canLaunch) void loadReview();
  }, [canLaunch, loadReview]);

  async function launch() {
    if (!review) return;
    if (review.finalRecipientCount >= 1000 && !confirmed) {
      setError("Confirm the large-send checkbox before launching.");
      return;
    }
    setLaunching(true);
    setError("");
    try {
      const res = await fetch(`/api/mass-texting/campaigns/${campaignId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmLargeSend: review.finalRecipientCount >= 1000 ? confirmed : true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Launch failed");
      if (!review.scheduledAt) {
        router.push(`/campaigns/${campaignId}`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  if (!canLaunch) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-amber-50/40 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            <Rocket className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-[14px] font-semibold tracking-tight text-amber-950">
              Pre-send review
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-amber-900/70">
              Review audience exclusions and expected usage before launching.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-300/70 bg-white/70 hover:bg-white"
          onClick={() => void loadReview()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {review ? (
        <div className="mt-3 grid gap-x-8 border-t border-amber-200/60 px-5 py-3 sm:grid-cols-2">
          <dl className="divide-y divide-amber-900/5">
            <ReviewRow
              label="Lists"
              value={review.listNames.join(", ") || "Recipients enrolled"}
            />
            <ReviewRow label="Original contacts" value={review.rawContactCount} />
            <ReviewRow label="Duplicates removed" value={review.duplicateRemoved} />
            <ReviewRow label="Invalid removed" value={review.invalidRemoved} />
            <ReviewRow label="Suppressed / STOP removed" value={review.suppressedRemoved} />
            <ReviewRow label="Final send count" value={review.finalRecipientCount} strong />
          </dl>
          <dl className="divide-y divide-amber-900/5">
            <ReviewRow label="Estimated credits" value={review.estimatedSegments} />
            <ReviewRow label="Available credits" value={review.availableSegments} />
            {review.mmsCount > 0 ? (
              <ReviewRow
                label="Picture messages (MMS)"
                value={`${review.mmsCount} · 3 credits each`}
              />
            ) : null}
            {review.mediaUrls && review.mediaUrls.length > 0 ? (
              <ReviewRow
                label="Attached media"
                value={
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                    {review.mediaUrls.length} image{review.mediaUrls.length === 1 ? "" : "s"}
                  </span>
                }
              />
            ) : null}
            <ReviewRow label="Sending number" value={review.phoneE164 || "Not assigned"} />
            <ReviewRow label="A2P use case" value={review.a2pUseCase} />
            <ReviewRow
              label="Scheduled"
              value={
                review.scheduledAt
                  ? review.timezone
                    ? formatZonedScheduleLabel(review.scheduledAt, review.timezone, { prefix: "" }).trim()
                    : new Date(review.scheduledAt).toLocaleString()
                  : "Send now"
              }
            />
          </dl>
        </div>
      ) : null}

      {review && review.shortage > 0 ? (
        <div className="mx-5 mb-3 rounded-lg border border-amber-300 bg-amber-100/70 p-3.5">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-950">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            Need {review.requiredSegments} credits · {review.availableSegments} available · short{" "}
            {review.shortage}
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-900/80">
            Buy more credits or upgrade before launching. This is not a server error.
          </p>
          <a
            href="/settings/billing"
            className="mt-2 inline-block text-[13px] font-medium text-amber-950 underline underline-offset-2 hover:text-amber-800"
          >
            Buy More Credits / Upgrade
          </a>
        </div>
      ) : null}

      {review && review.blockReason && !review.canSend && review.shortage <= 0 ? (
        <div className="mx-5 mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-[13px] text-rose-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{review.blockReason}</span>
        </div>
      ) : null}

      {review && review.finalRecipientCount >= 1000 ? (
        <label className="mx-5 mb-1 flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-white/60 px-3.5 py-2.5 text-[13px] text-amber-950">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-amber-600"
          />
          <span>
            I confirm sending to{" "}
            <span className="font-semibold tabular-nums">
              {review.finalRecipientCount.toLocaleString()}
            </span>{" "}
            recipients.
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <Button
          type="button"
          onClick={() => void launch()}
          disabled={launching || !review || !review.canSend}
        >
          {launching ? "Launching…" : "Confirm & launch"}
        </Button>
        {error ? (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
