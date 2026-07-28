import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { messageLogs, metrics } from "@/lib/mock/data";
import { formatCurrency, formatNumber, formatPercent, formatPhone } from "@/lib/utils";
import Link from "next/link";

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

export default function ReportsMessagesPage() {
  const delivered = messageLogs.filter((m) => m.status === "Delivered").length;
  const failed = messageLogs.filter((m) => m.status === "Failed").length;
  const totalCost = messageLogs.reduce((sum, m) => sum + m.cost, 0);

  return (
    <div>
      <PageHeader
        title="Message reports"
        description="Delivery logs with segment counts, status, and per-message cost."
        actions={
          <Button variant="outline">Export CSV</Button>
        }
      />

      <Tabs items={reportTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Period delivery rate" value={formatPercent(metrics.deliveryRate)} />
        <StatCard label="Delivered" value={formatNumber(delivered)} />
        <StatCard label="Failed" value={formatNumber(failed)} />
        <StatCard label="Log cost" value={formatCurrency(totalCost)} />
      </div>

      <Card>
        <CardTitle>Message log</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Time</TH>
              <TH>To</TH>
              <TH>From</TH>
              <TH>Campaign</TH>
              <TH>Status</TH>
              <TH>Segments</TH>
              <TH>Cost</TH>
              <TH>Preview</TH>
            </TR>
          </THead>
          <TBody>
            {messageLogs.map((m) => (
              <TR key={m.id}>
                <TD className="whitespace-nowrap text-muted-foreground">
                  {new Date(m.at).toLocaleString()}
                </TD>
                <TD>{formatPhone(m.to)}</TD>
                <TD>{formatPhone(m.from)}</TD>
                <TD>{m.campaign}</TD>
                <TD>
                  <StatusChip status={m.status} />
                </TD>
                <TD>{m.segments}</TD>
                <TD>{formatCurrency(m.cost)}</TD>
                <TD className="max-w-[200px] truncate text-muted-foreground">{m.body}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">
          Showing recent messages.{" "}
          <Link href="/reports/usage" className="font-medium text-primary hover:underline">
            View full usage report
          </Link>
        </p>
      </Card>
    </div>
  );
}
