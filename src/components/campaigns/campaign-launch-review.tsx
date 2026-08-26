"use client";

import { Button } from "@/components/ui/button";
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
  phoneE164: string | null;
  scheduledAt: string | null;
  a2pUseCase: string;
  availableSegments: number;
  requiredSegments: number;
  shortage: number;
  canSend: boolean;
  blockReason: string | null;
};

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
      const res = await fetch(`/api/campaigns/${campaignId}/launch-review`);
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
      const res = await fetch(`/api/campaigns/${campaignId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: `launch:${campaignId}`,
          confirmLargeSend: review.finalRecipientCount >= 1000 ? confirmed : true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Launch failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  if (!canLaunch) return null;

  return (
    <section className="rounded-[14px] border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-amber-950">Pre-send review</h2>
          <p className="mt-1 text-[13px] text-amber-900/80">
            Review audience exclusions and expected usage before launching.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadReview()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {review ? (
        <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Lists</dt>
            <dd className="font-medium">{review.listNames.join(", ") || "Recipients enrolled"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Original contacts</dt>
            <dd className="font-medium">{review.rawContactCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Duplicates removed</dt>
            <dd>{review.duplicateRemoved}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Invalid removed</dt>
            <dd>{review.invalidRemoved}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Suppressed / STOP removed</dt>
            <dd>{review.suppressedRemoved}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Final send count</dt>
            <dd className="font-semibold">{review.finalRecipientCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estimated credits</dt>
            <dd>{review.estimatedSegments}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Available credits</dt>
            <dd>{review.availableSegments}</dd>
          </div>
          {review.shortage > 0 ? (
            <div className="sm:col-span-2 rounded-md border border-amber-300 bg-amber-100/70 p-3">
              <p className="font-semibold text-amber-950">
                Need {review.requiredSegments} credits · {review.availableSegments} available ·
                short {review.shortage}
              </p>
              <p className="mt-1 text-[12px] text-amber-900/80">
                Buy more credits or upgrade before launching. This is not a server error.
              </p>
              <a href="/sms/settings" className="mt-2 inline-block text-[13px] font-medium underline">
                Buy More Credits / Upgrade
              </a>
            </div>
          ) : null}
          <div>
            <dt className="text-muted-foreground">Sending number</dt>
            <dd>{review.phoneE164 || "Not assigned"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">A2P use case</dt>
            <dd>{review.a2pUseCase}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Scheduled</dt>
            <dd>{review.scheduledAt ? new Date(review.scheduledAt).toLocaleString() : "Send now"}</dd>
          </div>
        </dl>
      ) : null}

      {review && review.finalRecipientCount >= 1000 ? (
        <label className="mt-4 flex items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I confirm sending to {review.finalRecipientCount.toLocaleString()} recipients.
          </span>
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void launch()} disabled={launching || !review || Boolean(review.shortage)}>
          {launching ? "Launching…" : "Confirm & launch"}
        </Button>
      </div>

      {error ? <p className="mt-2 text-[13px] text-rose-700">{error}</p> : null}
    </section>
  );
}
