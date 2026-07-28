import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminCustomers } from "@/lib/mock/data";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

const registrationPipeline = [
  { stage: "Brand submitted", count: 4 },
  { stage: "Brand pending review", count: 2 },
  { stage: "Campaign draft", count: 3 },
  { stage: "Campaign rejected", count: 1 },
];

const abuseAlerts = [
  { customer: "QuickMove Logistics", type: "High opt-out rate", severity: "Medium" as const },
  { customer: "Metro Auto Sales", type: "Prohibited terms detected", severity: "High" as const },
];

export default function AdminDashboardPage() {
  const activeCustomers = adminCustomers.length;
  const trials = adminCustomers.filter((c) => c.status === "Trial").length;
  const paid = adminCustomers.filter((c) => c.status === "Paid").length;
  const mrr = adminCustomers.reduce((sum, c) => sum + c.mrr, 0);
  const messageVolume = adminCustomers.reduce((sum, c) => sum + c.messages, 0);
  const twilioCost = messageVolume * 0.0085;
  const revenue = mrr + messageVolume * 0.015;
  const failedMessages = Math.round(messageVolume * 0.024);

  return (
    <div>
      <PageHeader
        title="Admin dashboard"
        description="Platform overview — customers, revenue, message volume, and compliance pipeline."
        actions={
          <Link href="/admin/customers">
            <Button variant="outline">View customers</Button>
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active customers" value={formatNumber(activeCustomers)} />
        <StatCard label="Trials" value={formatNumber(trials)} />
        <StatCard label="Paid accounts" value={formatNumber(paid)} />
        <StatCard label="MRR" value={formatCurrency(mrr)} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Message volume" value={formatNumber(messageVolume)} hint="Last 30 days" />
        <StatCard label="Est. Twilio cost" value={formatCurrency(twilioCost)} />
        <StatCard label="Est. revenue" value={formatCurrency(revenue)} />
        <StatCard label="Failed messages" value={formatNumber(failedMessages)} hint="~2.4% failure rate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>A2P registration pipeline</CardTitle>
          <ul className="mt-4 space-y-2">
            {registrationPipeline.map((stage) => (
              <li
                key={stage.stage}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
              >
                <span>{stage.stage}</span>
                <span className="font-medium">{formatNumber(stage.count)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/a2p"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Open A2P queue
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <CardTitle>Abuse alerts</CardTitle>
          </div>
          {abuseAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active alerts.</p>
          ) : (
            <ul className="space-y-2">
              {abuseAlerts.map((alert) => (
                <li
                  key={alert.customer}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{alert.customer}</p>
                    <p className="text-xs text-muted-foreground">{alert.type}</p>
                  </div>
                  <StatusChip status={alert.severity} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/admin/monitoring"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View monitoring
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitle>Recent customers</CardTitle>
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>MRR</TH>
              <TH>Messages</TH>
              <TH>A2P</TH>
              <TH>Risk</TH>
            </TR>
          </THead>
          <TBody>
            {adminCustomers.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                </TD>
                <TD>{c.plan}</TD>
                <TD>
                  <StatusChip status={c.status} />
                </TD>
                <TD>{formatCurrency(c.mrr)}</TD>
                <TD>{formatNumber(c.messages)}</TD>
                <TD>
                  <StatusChip status={c.a2p} />
                </TD>
                <TD>
                  <StatusChip status={c.risk} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
