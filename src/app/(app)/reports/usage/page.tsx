import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaigns, messageLogs, metrics, phoneNumbers, teamMembers } from "@/lib/mock/data";
import { formatCurrency, formatNumber, formatPhone } from "@/lib/utils";
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

const usageByUser = [
  { user: "Sam Patel", sent: 892, segments: 934, cost: 14.01 },
  { user: "Alex Rivera", sent: 488, segments: 512, cost: 7.68 },
  { user: "Jordan Lee", sent: 200, segments: 208, cost: 3.12 },
];

const usageByNumber = phoneNumbers.map((pn) => ({
  number: pn.number,
  name: pn.friendlyName,
  sent: pn.number === "+14155550142" ? 1420 : 160,
  segments: pn.number === "+14155550142" ? 1488 : 168,
  cost: pn.number === "+14155550142" ? 22.32 : 2.52,
}));

export default function ReportsUsagePage() {
  const smsSegments = messageLogs.reduce((sum, m) => sum + m.segments, 0) + 1542;
  const mmsCount = 12;
  const outbound = metrics.messagesSentPeriod;
  const inbound = 186;
  const totalCost = messageLogs.reduce((sum, m) => sum + m.cost, 0) + 23.7;

  return (
    <div>
      <PageHeader
        title="Usage & cost"
        description="SMS segments, MMS, inbound/outbound volume, and cost breakdown by user, number, and campaign."
        actions={
          <Link href="/settings/billing">
            <Button variant="outline">View billing</Button>
          </Link>
        }
      />

      <Tabs items={reportTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="SMS segments" value={formatNumber(smsSegments)} />
        <StatCard label="MMS messages" value={formatNumber(mmsCount)} />
        <StatCard label="Outbound" value={formatNumber(outbound)} />
        <StatCard label="Inbound" value={formatNumber(inbound)} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Period cost" value={formatCurrency(totalCost)} />
        <StatCard label="Credits remaining" value={formatNumber(metrics.creditsRemaining)} />
        <StatCard label="Account balance" value={formatCurrency(metrics.balance)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Usage by user</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Sent</TH>
                <TH>Segments</TH>
                <TH>Cost</TH>
              </TR>
            </THead>
            <TBody>
              {usageByUser.map((row) => (
                <TR key={row.user}>
                  <TD className="font-medium">{row.user}</TD>
                  <TD>{formatNumber(row.sent)}</TD>
                  <TD>{formatNumber(row.segments)}</TD>
                  <TD>{formatCurrency(row.cost)}</TD>
                </TR>
              ))}
              {teamMembers
                .filter((m) => !usageByUser.some((u) => u.user === m.name))
                .map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium text-muted-foreground">{m.name}</TD>
                    <TD>0</TD>
                    <TD>0</TD>
                    <TD>{formatCurrency(0)}</TD>
                  </TR>
                ))}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardTitle>Usage by number</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Name</TH>
                <TH>Sent</TH>
                <TH>Segments</TH>
                <TH>Cost</TH>
              </TR>
            </THead>
            <TBody>
              {usageByNumber.map((row) => (
                <TR key={row.number}>
                  <TD>{formatPhone(row.number)}</TD>
                  <TD className="font-medium">{row.name}</TD>
                  <TD>{formatNumber(row.sent)}</TD>
                  <TD>{formatNumber(row.segments)}</TD>
                  <TD>{formatCurrency(row.cost)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Usage by campaign</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Campaign</TH>
              <TH>Sent</TH>
              <TH>Segments (est.)</TH>
              <TH>Cost</TH>
            </TR>
          </THead>
          <TBody>
            {campaigns
              .filter((c) => c.sent > 0)
              .map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">{c.name}</TD>
                  <TD>{formatNumber(c.sent)}</TD>
                  <TD>{formatNumber(c.sent)}</TD>
                  <TD>{formatCurrency(c.cost)}</TD>
                </TR>
              ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
