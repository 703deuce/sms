import { Star } from "lucide-react";
import { loadLatestReputationAudit } from "@/lib/reputation/engine";
import { momentumBadgeClass } from "@/lib/reviews/metrics";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import { OverviewCardShell, Sparkline } from "@/components/overview/overview-charts";
import { cn } from "@/lib/utils";

function sparkFromScore(score: number) {
  const base = score / 100;
  return [base * 0.5, base * 0.55, base * 0.6, base * 0.58, base * 0.7, base * 0.75, base].map(
    (v) => Math.round(v * 100)
  );
}

export async function ReputationHealthOverviewCard({ businessId }: { businessId: string }) {
  const data = await loadLatestReputationAudit(businessId);

  if (!data?.audit) {
    return (
      <OverviewCardShell href={`/businesses/${businessId}/reputation`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Star className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Reputation Health</p>
            <p className="mt-2 text-3xl font-bold text-text">—</p>
            <p className="mt-2 text-xs text-text-muted">Run reputation audit</p>
          </div>
        </div>
      </OverviewCardShell>
    );
  }

  const { audit } = data;
  const score = audit.score != null ? Math.round(audit.score) : null;
  const rating = audit.rating != null ? `${Number(audit.rating).toFixed(1)}★` : "—";
  const sub = `${rating} · ${audit.total_reviews} reviews · ${audit.reviews_30d} new this month`;
  const momentumLabel = (audit.momentum_label as MomentumLabel) ?? "Stable";

  return (
    <OverviewCardShell href={`/businesses/${businessId}/reputation`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <Star className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-text">Reputation Health</p>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-text">
            {score != null ? `${score}/100` : rating}
          </p>
          <p className="mt-2 text-xs text-text-muted">{sub}</p>
          {momentumLabel && (
            <span
              className={cn(
                "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                momentumBadgeClass(momentumLabel)
              )}
            >
              {momentumLabel} momentum
            </span>
          )}
        </div>
        {score != null && (
          <Sparkline data={sparkFromScore(score)} color="#8b5cf6" width={72} height={28} />
        )}
      </div>
    </OverviewCardShell>
  );
}
