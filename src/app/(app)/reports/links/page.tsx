import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaigns, metrics } from "@/lib/mock/data";
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

const linkReports = [
  {
    id: "lnk_1",
    url: "https://trnv.io/july-service",
    shortUrl: "trnv.io/july",
    campaign: "July Service Special",
    clicks: 286,
    unique: 214,
    sent: 1204,
  },
  {
    id: "lnk_2",
    url: "https://trnv.io/vip",
    shortUrl: "trnv.io/vip",
    campaign: "Weekend Flash Sale",
    clicks: 8,
    unique: 7,
    sent: 44,
  },
  {
    id: "lnk_3",
    url: "https://trnv.io/schedule",
    shortUrl: "trnv.io/sched",
    campaign: "Appointment Reminder Wave",
    clicks: 0,
    unique: 0,
    sent: 0,
  },
  {
    id: "lnk_4",
    url: "https://trnv.io/welcome",
    shortUrl: "trnv.io/welcome",
    campaign: "Welcome series",
    clicks: 142,
    unique: 118,
    sent: 842,
  },
];

export default function ReportsLinksPage() {
  const totalClicks = linkReports.reduce((sum, l) => sum + l.clicks, 0);
  const totalUnique = linkReports.reduce((sum, l) => sum + l.unique, 0);
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
        <StatCard label="Unique clicks" value={formatNumber(totalUnique)} />
        <StatCard label="Messages with links" value={formatNumber(totalSent)} hint="Delivered this period" />
      </div>

      <Card>
        <CardTitle>Link click reports</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Short link</TH>
              <TH>Destination</TH>
              <TH>Campaign / source</TH>
              <TH>Clicks</TH>
              <TH>Unique</TH>
              <TH>CTR</TH>
            </TR>
          </THead>
          <TBody>
            {linkReports.map((link) => {
              const ctr = link.sent > 0 ? (link.clicks / link.sent) * 100 : 0;
              return (
                <TR key={link.id}>
                  <TD className="font-medium">{link.shortUrl}</TD>
                  <TD className="max-w-[200px] truncate text-muted-foreground">{link.url}</TD>
                  <TD>{link.campaign}</TD>
                  <TD>{formatNumber(link.clicks)}</TD>
                  <TD>{formatNumber(link.unique)}</TD>
                  <TD>{link.sent > 0 ? formatPercent(ctr) : "—"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
