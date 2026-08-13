import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MetricCard, SectionHeader } from "@/components/ui/metric";
import { Tabs } from "@/components/ui/tabs";
import {
  loadAuditLogs,
  loadAutomations,
  loadDashboardMetrics,
  requireWorkspaceContext,
} from "@/lib/workspace-data";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import {
  BarChart3,
  ChevronRight,
  Coins,
  Download,
  Inbox,
  Link2,
  Megaphone,
  Phone,
  ScrollText,
  Send,
  Shield,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

export default async function ReportsOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [metrics, automations, auditLogs] = await Promise.all([
    loadDashboardMetrics(workspaceId),
    loadAutomations(workspaceId),
    loadAuditLogs(workspaceId),
  ]);

  const activeAutomations = automations.filter((a) => a.status === "Active").length;

  const drillDowns: Array<{
    title: string;
    description: string;
    href: string;
    value: string;
    icon: LucideIcon;
    tone: string;
  }> = [
    {
      title: "Campaign performance",
      description: "Delivery, replies, clicks, and opt-outs by campaign.",
      href: "/reports/campaigns",
      value: formatNumber(metrics.messagesSentPeriod),
      icon: Megaphone,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      title: "Message delivery",
      description: "Segment-level logs with status and cost.",
      href: "/reports/messages",
      value: formatPercent(metrics.deliveryRate),
      icon: Send,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      title: "Contact growth",
      description: "Subscribers, opt-outs, and list growth over time.",
      href: "/reports/contacts",
      value: `+${formatNumber(metrics.contactGrowth)}`,
      icon: Users,
      tone: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "Inbox activity",
      description: "Response times, open conversations, and agent workload.",
      href: "/reports/inbox",
      value: formatPercent(metrics.replyRate),
      icon: Inbox,
      tone: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "Automation flows",
      description: "Enrollment, completion rates, and message volume.",
      href: "/reports/automations",
      value: `${activeAutomations} active`,
      icon: Workflow,
      tone: "bg-orange-50 text-orange-600",
    },
    {
      title: "Link tracking",
      description: "Click-through rates and top-performing links.",
      href: "/reports/links",
      value: formatPercent(metrics.clickRate),
      icon: Link2,
      tone: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "Usage & billing",
      description: "Credits consumed, segment costs, and balance.",
      href: "/reports/usage",
      value: formatNumber(metrics.creditsRemaining),
      icon: Coins,
      tone: "bg-amber-50 text-amber-600",
    },
    {
      title: "Audit log",
      description: "Account activity, imports, and permission changes.",
      href: "/reports/audit-log",
      value: `${auditLogs.length} events`,
      icon: ScrollText,
      tone: "bg-slate-100 text-slate-600",
    },
  ];

  const a2pProgress = metrics.a2pStatus === "Approved" ? 100 : metrics.a2pStatus === "Pending" ? 55 : 20;

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={BarChart3}
        iconTone="bg-indigo-50 text-indigo-600"
        title="Reports"
        description="Performance metrics across campaigns, messaging, contacts, and account activity."
        actions={
          <Link href="/reports/usage">
            <Button variant="outline" className="h-9 rounded-[10px] text-[13px]">
              <Download className="h-4 w-4" />
              Export usage
            </Button>
          </Link>
        }
      />

      <Tabs items={reportTabs} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Messages sent"
          value={formatNumber(metrics.messagesSentPeriod)}
          hint="Current billing period"
          icon={Send}
          tone="bg-violet-50 text-violet-600"
          sparkline={[8, 9, 12, 11, 14, 13, 15, 17]}
          sparkColor="#6366f1"
          href="/reports/messages"
        />
        <MetricCard
          label="Delivery rate"
          value={formatPercent(metrics.deliveryRate)}
          hint="Period aggregate"
          icon={Send}
          tone="bg-indigo-50 text-indigo-600"
          sparkline={[12, 13, 12, 15, 14, 16, 17, 18]}
          sparkColor="#0ea5e9"
          href="/reports/messages"
        />
        <MetricCard
          label="Reply rate"
          value={formatPercent(metrics.replyRate)}
          hint="Period aggregate"
          icon={Inbox}
          tone="bg-violet-50 text-violet-600"
          sparkline={[8, 9, 10, 9, 11, 12, 11, 13]}
          sparkColor="#8b5cf6"
          href="/reports/inbox"
        />
        <MetricCard
          label="Click rate"
          value={formatPercent(metrics.clickRate)}
          hint="Period aggregate"
          icon={Link2}
          tone="bg-orange-50 text-orange-600"
          sparkline={[6, 8, 7, 10, 12, 11, 14, 15]}
          sparkColor="#f97316"
          href="/reports/links"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Contact growth"
          value={`+${formatNumber(metrics.contactGrowth)}`}
          hint={`Opt-out ${formatPercent(metrics.optOutRate)}`}
          icon={Users}
          tone="bg-violet-50 text-violet-600"
          sparkline={[4, 6, 5, 8, 9, 11, 12, 14]}
          sparkColor="#6366f1"
          href="/reports/contacts"
        />
        <MetricCard
          label="Credits remaining"
          value={formatNumber(metrics.creditsRemaining)}
          hint={`Balance ${formatCurrency(metrics.balance)}`}
          icon={Coins}
          tone="bg-violet-50 text-violet-600"
          sparkline={[10, 12, 11, 14, 13, 16, 15, 18]}
          sparkColor="#8b5cf6"
          href="/reports/usage"
        />
        <Card className="rounded-[12px] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                A2P status
              </p>
              <p className="mt-2 text-[22px] font-bold tracking-tight text-foreground">
                {metrics.a2pStatus}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Brand & campaign registration
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600">
              <Shield className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${a2pProgress}%` }} />
          </div>
        </Card>
        <MetricCard
          label="Active number"
          value={metrics.activeNumber}
          hint="Default sending number"
          icon={Phone}
          tone="bg-indigo-50 text-indigo-600"
          href="/numbers"
        />
      </div>

      <Card className="p-5">
        <h2 className="text-[14px] font-bold text-foreground">Drill-down reports</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {drillDowns.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-[12px] border border-border p-4 transition hover:border-primary/30 hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                    item.tone,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[15px] font-bold tabular-nums text-foreground">
                    {item.value}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                </span>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
