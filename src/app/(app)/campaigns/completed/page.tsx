import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import type { Campaign } from "@/lib/types";
import { loadCampaigns } from "@/lib/workspace-data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { campaignTabs } from "@/lib/campaign-tabs";

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

export default async function CampaignCompletedPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Completed campaigns" description="Finished sends with full delivery and engagement metrics." />
        <EmptyState title="No workspace selected" description="Select or create a workspace to view campaigns." />
      </div>
    );
  }

  const completed: Campaign[] = await loadCampaigns(workspaceId, "COMPLETED");
  const totalSent = completed.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = completed.reduce((sum, c) => sum + c.delivered, 0);
  const totalReplies = completed.reduce((sum, c) => sum + c.replies, 0);
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Completed campaigns"
        description="Finished sends with full delivery and engagement metrics."
        actions={
          <Link href="/reports/campaigns">
            <Button variant="outline">Campaign reports</Button>
          </Link>
        }
      />

      <Tabs items={campaignTabs} />

      {completed.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8" />}
          title="No completed campaigns"
          description="Once a campaign finishes sending, it will appear here with delivery and engagement stats."
          actionLabel="Send campaign"
          actionHref="/send"
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total sent" value={formatNumber(totalSent)} />
            <StatCard
              label="Delivered"
              value={formatNumber(totalDelivered)}
              hint={formatPercent(deliveryRate)}
            />
            <StatCard label="Replies" value={formatNumber(totalReplies)} />
            <StatCard
              label="Total cost"
              value={formatCurrency(completed.reduce((sum, c) => sum + c.cost, 0))}
            />
          </div>

          <Card>
            <CardTitle>{completed.length} completed</CardTitle>
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
                {completed.map((c) => (
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
