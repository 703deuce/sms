import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { loadCampaigns, requireWorkspaceContext } from "@/lib/workspace-data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import Link from "next/link";

import { analyticsTabs } from "@/lib/analytics-tabs";

export default async function ReportsCampaignsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const campaigns = await loadCampaigns(workspaceId);

  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalDelivered = campaigns.reduce((sum, c) => sum + c.delivered, 0);
  const totalReplies = campaigns.reduce((sum, c) => sum + c.replies, 0);
  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Campaign reports"
        description="Performance breakdown for outbound campaigns by audience, status, and cost."
        actions={
          <Link href="/campaigns">
            <Button variant="outline">View campaigns</Button>
          </Link>
        }
      />

      <Tabs items={analyticsTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sent" value={formatNumber(totalSent)} />
        <StatCard label="Delivered" value={formatNumber(totalDelivered)} hint={formatPercent(deliveryRate)} />
        <StatCard label="Replies" value={formatNumber(totalReplies)} />
        <StatCard
          label="Total cost"
          value={formatCurrency(campaigns.reduce((sum, c) => sum + c.cost, 0))}
        />
      </div>

      <Card>
        <CardTitle>Campaign performance</CardTitle>
        {campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Campaign performance will appear here after you send."
            actionLabel="View campaigns"
            actionHref="/campaigns"
          />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Campaign</TH>
                <TH>Status</TH>
                <TH>Audience</TH>
                <TH>Sent</TH>
                <TH>Delivered</TH>
                <TH>Replies</TH>
                <TH>Clicks</TH>
                <TH>Opt-outs</TH>
                <TH>Cost</TH>
              </TR>
            </THead>
            <TBody>
              {campaigns.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>
                    <StatusChip status={c.status} />
                  </TD>
                  <TD className="text-muted-foreground">{c.audience}</TD>
                  <TD>{formatNumber(c.sent)}</TD>
                  <TD>{formatNumber(c.delivered)}</TD>
                  <TD>{formatNumber(c.replies)}</TD>
                  <TD>{formatNumber(c.clicks)}</TD>
                  <TD>{formatNumber(c.optOuts)}</TD>
                  <TD>{formatCurrency(c.cost)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
