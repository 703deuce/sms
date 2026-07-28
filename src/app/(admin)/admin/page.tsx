import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { MetricCard, SectionHeader } from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminCustomers } from "@/lib/mock/data";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  DollarSign,
  Users,
} from "lucide-react";
import Link from "next/link";

const registrationPipeline = [
  { stage: "Brand submitted", count: 4 },
  { stage: "Brand pending", count: 2 },
  { stage: "Campaign draft", count: 3 },
  { stage: "Campaign rejected", count: 1 },
];

const abuseAlerts = [
  { customer: "QuickMove", type: "High opt-out rate", severity: "Medium" as const },
  { customer: "Metro Auto Sales", type: "Prohibited terms detected", severity: "High" as const },
];

const customerMeta: Record<string, { initials: string; tone: string; joined: string }> = {
  ac_1: { initials: "HH", tone: "bg-emerald-500", joined: "Jun 12, 2026" },
  ac_2: { initials: "BP", tone: "bg-violet-500", joined: "Mar 4, 2026" },
  ac_3: { initials: "QL", tone: "bg-orange-500", joined: "Jan 18, 2026" },
};

export default function AdminDashboardPage() {
  const activeCustomers = adminCustomers.length;
  const trials = adminCustomers.filter((c) => c.status === "Trial").length;
  const paid = adminCustomers.filter((c) => c.status === "Paid").length;
  const mrr = adminCustomers.reduce((sum, c) => sum + c.mrr, 0);
  const messageVolume = adminCustomers.reduce((sum, c) => sum + c.messages, 0);
  const twilioCost = messageVolume * 0.0085;
  const revenue = mrr + messageVolume * 0.015;
  const failedMessages = Math.round(messageVolume * 0.024);
  const failureRate = ((failedMessages / messageVolume) * 100).toFixed(1);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Admin dashboard"
        description="Platform overview — customers, revenue, message volume, and compliance pipeline."
        actions={
          <Link href="/admin/customers">
            <Button variant="outline" className="rounded-[10px]">
              View customers
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Customers"
          value={activeCustomers}
          hint="↑50%"
          icon={Users}
          tone="bg-blue-50 text-blue-600"
          href="/admin/customers"
        />
        <MetricCard
          label="Trials"
          value={trials}
          icon={Users}
          tone="bg-sky-50 text-sky-600"
          href="/admin/customers"
        />
        <MetricCard
          label="Paid Accounts"
          value={paid}
          hint="↑100%"
          icon={CreditCard}
          tone="bg-emerald-50 text-emerald-600"
          href="/admin/customers"
        />
        <MetricCard
          label="MRR"
          value={formatCurrency(mrr)}
          hint="↑12.3%"
          icon={DollarSign}
          tone="bg-violet-50 text-violet-600"
          href="/admin/billing"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Message Volume"
          value={formatNumber(messageVolume)}
          sparkline={[12, 14, 13, 16, 18, 17, 20, 22]}
          sparkColor="#3b82f6"
        />
        <MetricCard
          label="Est Twilio Cost"
          value={formatCurrency(twilioCost)}
          sparkline={[10, 11, 12, 13, 14, 15, 16, 17]}
          sparkColor="#f97316"
        />
        <MetricCard
          label="Est Revenue"
          value={formatCurrency(revenue)}
          sparkline={[8, 10, 11, 13, 14, 16, 18, 19]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="Failed Messages"
          value={formatNumber(failedMessages)}
          hint={`~${failureRate}%`}
          sparkline={[6, 5, 7, 6, 8, 7, 9, 8]}
          sparkColor="#ef4444"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>A2P registration pipeline</CardTitle>
          <ul className="mt-4 space-y-2">
            {registrationPipeline.map((stage) => (
              <li
                key={stage.stage}
                className="flex items-center justify-between rounded-[10px] border border-border px-4 py-2.5 text-[13px]"
              >
                <span className="text-foreground">{stage.stage}</span>
                <span className="font-semibold text-foreground">{formatNumber(stage.count)}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/a2p"
            className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
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
          <ul className="space-y-2">
            {abuseAlerts.map((alert) => (
              <li
                key={alert.customer}
                className="flex items-center justify-between rounded-[10px] border border-border px-4 py-2.5"
              >
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{alert.customer}</p>
                  <p className="text-[12px] text-muted-foreground">{alert.type}</p>
                </div>
                <StatusChip status={alert.severity} />
              </li>
            ))}
          </ul>
          <Link
            href="/admin/monitoring"
            className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline"
          >
            View monitoring
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <CardTitle>Recent customers</CardTitle>
          <Link
            href="/admin/customers"
            className="text-[12px] font-semibold text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Plan</TH>
              <TH>Status</TH>
              <TH>MRR</TH>
              <TH>Messages</TH>
              <TH>A2P</TH>
              <TH>Risk</TH>
              <TH>Joined</TH>
            </TR>
          </THead>
          <TBody>
            {adminCustomers.map((c) => {
              const meta = customerMeta[c.id];
              return (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="flex items-center gap-2.5 font-medium text-primary hover:underline"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-bold text-white",
                          meta?.tone ?? "bg-slate-400",
                        )}
                      >
                        {meta?.initials ?? c.name.slice(0, 2).toUpperCase()}
                      </span>
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
                  <TD className="text-muted-foreground">{meta?.joined ?? "—"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
