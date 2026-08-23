import { Send, Mail } from "lucide-react";
import { requireAuth } from "@/lib/auth/context";
import { loadReviewRequestStats } from "@/lib/reputation/review-sends";
import { OverviewCardShell } from "@/components/overview/overview-charts";

export async function ReviewRequestsOverviewCard({ businessId }: { businessId: string }) {
  const auth = await requireAuth();
  let stats = null;

  try {
    stats = await loadReviewRequestStats(businessId, auth.organizationId);
  } catch {
    stats = null;
  }

  const count = stats?.last_30_days ?? 0;
  const breakdown = stats
    ? `${stats.email_sent} email · ${stats.sms_sent} SMS${stats.failed > 0 ? ` · ${stats.failed} failed` : ""}`
    : null;

  return (
    <OverviewCardShell href={`/businesses/${businessId}/review-requests`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-primary">
            <Send className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">Review Requests</p>
            <p className="mt-1.5 text-base font-bold tabular-nums text-text">
              {stats ? String(count) : "—"}
            </p>
            {stats ? (
              <>
                <p className="mt-1 text-[11px] text-text-muted">{count} sent this month</p>
                {breakdown && <p className="mt-0.5 text-[11px] text-text-muted">{breakdown}</p>}
              </>
            ) : (
              <p className="mt-1.5 text-[11px] text-text-muted">Send review requests from Reputation</p>
            )}
          </div>
        </div>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-emerald-50/60 text-emerald-300">
          <Mail className="h-8 w-8" strokeWidth={1.5} />
        </div>
      </div>
    </OverviewCardShell>
  );
}
