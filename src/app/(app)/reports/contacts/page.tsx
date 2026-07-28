import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { contacts, lists, metrics, segments } from "@/lib/mock/data";
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

export default function ReportsContactsPage() {
  const subscribed = contacts.filter((c) => c.status === "Subscribed").length;
  const unsubscribed = contacts.filter((c) => c.status === "Unsubscribed").length;
  const blocked = contacts.filter((c) => c.status === "Blocked").length;

  return (
    <div>
      <PageHeader
        title="Contact growth"
        description="Subscriber counts, list growth, and consent status across your audience."
      />

      <Tabs items={reportTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New this period" value={`+${formatNumber(metrics.contactGrowth)}`} />
        <StatCard label="Subscribed" value={formatNumber(subscribed)} />
        <StatCard label="Unsubscribed" value={formatNumber(unsubscribed)} />
        <StatCard label="Opt-out rate" value={formatPercent(metrics.optOutRate)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Lists</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>List</TH>
                <TH>Contacts</TH>
                <TH>Description</TH>
              </TR>
            </THead>
            <TBody>
              {lists.map((list) => (
                <TR key={list.id}>
                  <TD className="font-medium">{list.name}</TD>
                  <TD>{formatNumber(list.count)}</TD>
                  <TD className="text-muted-foreground">{list.description}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardTitle>Segments</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Segment</TH>
                <TH>Count</TH>
                <TH>Conditions</TH>
              </TR>
            </THead>
            <TBody>
              {segments.map((seg) => (
                <TR key={seg.id}>
                  <TD className="font-medium">{seg.name}</TD>
                  <TD>{formatNumber(seg.count)}</TD>
                  <TD className="text-muted-foreground">{seg.conditions}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Status breakdown</CardTitle>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-2">
            <StatusChip status="Subscribed" />
            <span className="text-sm font-medium">{formatNumber(subscribed)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-2">
            <StatusChip status="Unsubscribed" />
            <span className="text-sm font-medium">{formatNumber(unsubscribed)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-2">
            <StatusChip status="Blocked" />
            <span className="text-sm font-medium">{formatNumber(blocked)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
