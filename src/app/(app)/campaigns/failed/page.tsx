import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaigns } from "@/lib/mock/data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

const campaignTabs = [
  { label: "All", href: "/campaigns" },
  { label: "Drafts", href: "/campaigns/drafts" },
  { label: "Scheduled", href: "/campaigns/scheduled" },
  { label: "Calendar", href: "/campaigns/calendar" },
  { label: "Completed", href: "/campaigns/completed" },
  { label: "Failed", href: "/campaigns/failed" },
];

const failureReasons = [
  {
    reason: "Invalid number",
    count: 12,
    description: "Landline, disconnected, or malformed phone numbers in the audience.",
  },
  {
    reason: "Unsubscribed",
    count: 8,
    description: "Contacts opted out before or during the send window.",
  },
  {
    reason: "Insufficient balance",
    count: 0,
    description: "Send paused when account credits dropped below the minimum threshold.",
  },
  {
    reason: "Carrier rejection",
    count: 14,
    description: "Messages blocked by carrier spam filters or content policies.",
  },
  {
    reason: "A2P registration",
    count: 4,
    description: "10DLC traffic rejected due to pending brand or campaign registration.",
  },
  {
    reason: "Quiet hours",
    count: 2,
    description: "Messages blocked by account quiet-hour or timezone policy.",
  },
];

function formatScheduled(at: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CampaignFailedPage() {
  const failed = campaigns.filter((c) => c.status === "Failed");
  const totalFailedMessages = failureReasons.reduce((sum, r) => sum + r.count, 0);
  const totalSent = failed.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = failed.reduce((sum, c) => sum + c.delivered, 0);
  const failureRate = totalSent > 0 ? ((totalSent - totalDelivered) / totalSent) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Failed campaigns"
        description="Campaigns that did not complete successfully. Review failure reasons and retry eligible contacts."
        actions={
          <Link href="/compliance">
            <Button variant="outline">Compliance center</Button>
          </Link>
        }
      />

      <Tabs items={campaignTabs} />

      {failed.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="No failed campaigns"
          description="Failed sends appear here with carrier codes and remediation steps."
          actionLabel="View all campaigns"
          actionHref="/campaigns"
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Failed campaigns" value={formatNumber(failed.length)} />
            <StatCard label="Undelivered" value={formatNumber(totalFailedMessages)} />
            <StatCard
              label="Failure rate"
              value={formatPercent(failureRate)}
              hint={`${formatNumber(totalDelivered)} of ${formatNumber(totalSent)} delivered`}
            />
            <StatCard
              label="Cost incurred"
              value={formatCurrency(failed.reduce((sum, c) => sum + c.cost, 0))}
            />
          </div>

          <div className="mb-6 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardTitle>Failure reasons</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Breakdown across failed campaigns in this workspace.
              </p>
              <ul className="mt-4 space-y-3">
                {failureReasons.map((item) => (
                  <li
                    key={item.reason}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.reason}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <span className="shrink-0 font-display text-lg font-semibold tabular-nums">
                      {formatNumber(item.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>Recommended actions</CardTitle>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex gap-2 rounded-lg bg-muted/50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium">Validate audience numbers</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Remove invalid and landline contacts before retrying Storm Alert.
                    </p>
                  </div>
                </li>
                <li className="flex gap-2 rounded-lg bg-muted/50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium">Complete A2P registration</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Pending brand registration may cause carrier rejections on local numbers.
                    </p>
                    <Link href="/compliance" className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                      Open compliance
                    </Link>
                  </div>
                </li>
                <li className="flex gap-2 rounded-lg bg-muted/50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-medium">Review quiet-hour settings</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Early-morning alerts may be blocked in recipient time zones.
                    </p>
                  </div>
                </li>
              </ul>
            </Card>
          </div>

          <Card>
            <CardTitle>{failed.length} failed</CardTitle>
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Type</TH>
                  <TH>Audience</TH>
                  <TH>Scheduled</TH>
                  <TH>Status</TH>
                  <TH>Sent</TH>
                  <TH>Delivered</TH>
                  <TH>Replies</TH>
                  <TH>Clicks</TH>
                  <TH>Opt-outs</TH>
                  <TH>Created by</TH>
                </TR>
              </THead>
              <TBody>
                {failed.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{c.type}</TD>
                    <TD className="text-muted-foreground">{c.audience}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">
                      {formatScheduled(c.scheduledAt)}
                    </TD>
                    <TD>
                      <StatusChip status={c.status} />
                    </TD>
                    <TD>{formatNumber(c.sent)}</TD>
                    <TD>{formatNumber(c.delivered)}</TD>
                    <TD>{formatNumber(c.replies)}</TD>
                    <TD>{formatNumber(c.clicks)}</TD>
                    <TD>{formatNumber(c.optOuts)}</TD>
                    <TD className="text-muted-foreground">{c.createdBy}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
