import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard, SectionHeader } from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  loadAdminCustomers,
  loadAdminRegistrationPipeline,
  loadAdminUsageTotals,
} from "@/lib/admin-data";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  MessageSquare,
  MoreHorizontal,
  Settings2,
  Shield,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  const [adminCustomers, usageTotals, pipeline] = await Promise.all([
    loadAdminCustomers(),
    loadAdminUsageTotals(),
    loadAdminRegistrationPipeline(),
  ]);

  const activeCustomers = adminCustomers.length;
  const trials = adminCustomers.filter((c) => c.status === "Trial").length;
  const paid = adminCustomers.filter((c) => c.status === "Paid").length;
  const mrr = adminCustomers.reduce((sum, c) => sum + c.mrr, 0);
  const messageVolume = usageTotals.messageVolume;
  const telnyxCost = usageTotals.telnyxCost;
  const revenue = mrr + usageTotals.revenue;
  const failedMessages = usageTotals.failed;
  const failureRate = usageTotals.failureRate.toFixed(1);

  const registrationPipeline: Array<{
    stage: string;
    count: number;
    icon: LucideIcon;
    tone: string;
  }> = [
    { stage: "Brand submitted", count: pipeline.brandSubmitted, icon: Shield, tone: "bg-emerald-50 text-emerald-600" },
    { stage: "Brand pending review", count: pipeline.brandPending, icon: Clock, tone: "bg-orange-50 text-orange-600" },
    { stage: "Campaign draft", count: pipeline.campaignDraft, icon: FileText, tone: "bg-blue-50 text-blue-600" },
    { stage: "Campaign rejected", count: pipeline.campaignRejected, icon: XCircle, tone: "bg-rose-50 text-rose-600" },
  ];

  const highRisk = adminCustomers.filter((c) => c.risk === "High" || c.risk === "Medium");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Admin dashboard"
        description="Platform overview — customers, revenue, message volume, and compliance pipeline"
        actions={
          <Link href="/admin/customers">
            <Button variant="outline" className="rounded-[10px]">
              <Users className="h-4 w-4" />
              View customers
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Workspaces"
          value={activeCustomers}
          hint="Total on platform"
          icon={Users}
          tone="bg-emerald-50 text-emerald-600"
          href="/admin/customers"
        />
        <MetricCard
          label="Trials"
          value={trials}
          icon={Users}
          tone="bg-violet-50 text-violet-600"
          href="/admin/customers"
        />
        <MetricCard
          label="Paid Accounts"
          value={paid}
          icon={CreditCard}
          tone="bg-blue-50 text-blue-600"
          href="/admin/customers"
        />
        <MetricCard
          label="MRR"
          value={formatCurrency(mrr)}
          icon={DollarSign}
          tone="bg-emerald-50 text-emerald-600"
          href="/admin/billing"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Message Volume"
          value={formatNumber(messageVolume)}
          hint="Aggregate outbound"
          icon={MessageSquare}
          tone="bg-blue-50 text-blue-600"
        />
        <MetricCard
          label="Est. Telnyx Cost"
          value={formatCurrency(telnyxCost)}
          icon={Settings2}
          tone="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="Est. Revenue"
          value={formatCurrency(revenue)}
          icon={TrendingUp}
          tone="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Failed Messages"
          value={formatNumber(failedMessages)}
          hint={`~${failureRate}% failure rate`}
          icon={AlertTriangle}
          tone="bg-rose-50 text-rose-600"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>A2P registration pipeline</CardTitle>
          <ul className="mt-4 space-y-2">
            {registrationPipeline.map((stage) => {
              const Icon = stage.icon;
              return (
                <li
                  key={stage.stage}
                  className="flex items-center justify-between rounded-[10px] border border-border px-4 py-2.5 text-[13px]"
                >
                  <span className="inline-flex items-center gap-2.5 text-foreground">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-[8px]", stage.tone)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {stage.stage}
                  </span>
                  <span className="font-semibold text-foreground">{formatNumber(stage.count)}</span>
                </li>
              );
            })}
          </ul>
          <Link href="/admin/a2p" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
            Open A2P queue →
          </Link>
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <CardTitle>Risk alerts</CardTitle>
          </div>
          {highRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">No elevated-risk workspaces.</p>
          ) : (
            <ul className="space-y-2">
              {highRisk.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-[10px] border border-border px-4 py-2.5"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{c.name}</p>
                    <p className="text-[12px] text-muted-foreground">A2P: {c.a2p}</p>
                  </div>
                  <StatusChip status={c.risk} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/monitoring" className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
            View monitoring →
          </Link>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <CardTitle>Workspaces</CardTitle>
          <Link href="/admin/customers" className="text-[12px] font-semibold text-primary hover:underline">
            View all →
          </Link>
        </div>
        {adminCustomers.length === 0 ? (
          <EmptyState title="No workspaces" description="Workspaces will appear as accounts are created." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH>MRR</TH>
                <TH>Messages</TH>
                <TH>A2P Status</TH>
                <TH>Risk Level</TH>
                <TH>Members</TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {adminCustomers.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
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
                  <TD className="text-muted-foreground">{c.memberCount}</TD>
                  <TD>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      aria-label={`Actions for ${c.name}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <p className="mt-3 text-center text-[12px] text-muted-foreground">
          Showing {adminCustomers.length} workspace{adminCustomers.length === 1 ? "" : "s"}.
        </p>
      </Card>
    </div>
  );
}
