import Link from "next/link";
import { Button } from "@/components/ui/button";
import { loadMassTextOverviewMetrics } from "@/lib/mass-texting/overview-metrics";
import { getMassTextingBillingSummary } from "@/lib/mass-texting/billing-account";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { formatCurrency } from "@/lib/utils";

export default async function MassTextAnalyticsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, billing] = await Promise.all([
    loadMassTextOverviewMetrics(workspaceId),
    getMassTextingBillingSummary(workspaceId),
  ]);

  const monthlyUsed = billing.monthlySegmentsUsed;
  const monthlyIncluded = billing.monthlySegmentsIncluded;
  const paygCredits = billing.paygCreditsSegments;
  const trialRemaining = billing.trialSegmentsRemaining;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Mass Texting analytics</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Campaign delivery, replies, and segment usage for Mass Texting.
          </p>
        </div>
        <Link href="/reports/campaigns">
          <Button variant="outline" className="h-9 rounded-[10px]">
            Full campaign reports
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sent this month", value: metrics.messagesSentMonth.toLocaleString() },
          { label: "Delivered (all time)", value: metrics.delivered.toLocaleString() },
          { label: "Delivery rate", value: `${metrics.deliveryRate}%` },
          { label: "Replies", value: metrics.replies.toLocaleString() },
          { label: "Reply rate", value: `${metrics.replyRate}%` },
          { label: "Opt-outs", value: metrics.optOuts.toLocaleString() },
          {
            label: "Monthly segments remaining",
            value: billing.monthlySegmentsRemaining.toLocaleString(),
          },
          { label: "PAYG credits", value: paygCredits.toLocaleString() },
          { label: "Trial segments left", value: trialRemaining.toLocaleString() },
          {
            label: "Lifecycle",
            value: billing.lifecycleState,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[14px] border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[14px] border border-border bg-card p-5">
        <h2 className="text-[16px] font-semibold">Segment usage</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Billing is based on SMS segments, not message rows. Multi-segment texts count accordingly.
        </p>
        <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Monthly used</dt>
            <dd className="font-semibold">
              {monthlyUsed.toLocaleString()} / {monthlyIncluded.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">PAYG balance</dt>
            <dd className="font-semibold">{paygCredits.toLocaleString()} segments</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Legacy wallet (if any)</dt>
            <dd className="font-semibold">{formatCurrency(metrics.creditsRemainingCents / 100)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
