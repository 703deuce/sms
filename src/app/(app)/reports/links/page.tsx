import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  loadCampaigns,
  loadDashboardMetrics,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { formatNumber, formatPercent } from "@/lib/utils";

const reportTabs = [
  { label: "Overview", href: "/reports" },
  { label: "Campaigns", href: "/reports/campaigns" },
  { label: "Messages", href: "/reports/messages" },
  { label: "Contacts", href: "/reports/contacts" },
  { label: "Inbox", href: "/reports/inbox" },
  { label: "Automations", href: "/reports/automations" },
  { label: "Links", href: "/reports/links" },
  { label: "Usage", href: "/reports/usage" },
  { label: "Audit log", href: "/reports/audit-log" },
];

export default async function ReportsLinksPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, campaigns] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadCampaigns(workspaceId),
  ]);

  const linkReports = campaigns
    .filter((c) => c.clicks > 0 || c.sent > 0)
    .map((c) => ({
      id: c.id,
      campaign: c.name,
      clicks: c.clicks,
      sent: c.sent,
    }));

  const totalClicks = linkReports.reduce((sum, l) => sum + l.clicks, 0);
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);

  return (
    <div>
      <PageHeader
        title="Link reports"
        description="Click-through rates and performance for tracked links in campaigns and automations."
        actions={<Button variant="outline">Export CSV</Button>}
      />

      <Tabs items={reportTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Click rate" value={formatPercent(metrics.clickRate)} />
        <StatCard label="Total clicks" value={formatNumber(totalClicks)} />
        <StatCard label="Campaigns with links" value={formatNumber(linkReports.length)} />
        <StatCard label="Messages sent" value={formatNumber(totalSent)} hint="Delivered this period" />
      </div>

      <Card>
        <CardTitle>Link click reports</CardTitle>
        {linkReports.length === 0 ? (
          <EmptyState
            title="No link data"
            description="Click tracking appears when campaigns include tracked links."
          />
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Campaign / source</TH>
                <TH>Clicks</TH>
                <TH>Sent</TH>
                <TH>CTR</TH>
              </TR>
            </THead>
            <TBody>
              {linkReports.map((link) => {
                const ctr = link.sent > 0 ? (link.clicks / link.sent) * 100 : 0;
                return (
                  <TR key={link.id}>
                    <TD className="font-medium">{link.campaign}</TD>
                    <TD>{formatNumber(link.clicks)}</TD>
                    <TD>{formatNumber(link.sent)}</TD>
                    <TD>{link.sent > 0 ? formatPercent(ctr) : "—"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
