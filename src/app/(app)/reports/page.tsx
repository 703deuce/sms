import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { metrics } from "@/lib/mock/data";
import { formatNumber, formatPercent } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
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

const drillDowns = [
  {
    title: "Campaign performance",
    description: "Delivery, replies, clicks, and opt-outs by campaign.",
    href: "/reports/campaigns",
    metric: formatNumber(metrics.messagesSentPeriod),
  },
  {
    title: "Message delivery",
    description: "Segment-level logs with status and cost.",
    href: "/reports/messages",
    metric: formatPercent(metrics.deliveryRate),
  },
  {
    title: "Contact growth",
    description: "Subscribers, opt-outs, and list growth over time.",
    href: "/reports/contacts",
    metric: `+${formatNumber(metrics.contactGrowth)}`,
  },
  {
    title: "Inbox activity",
    description: "Response times, open conversations, and agent workload.",
    href: "/reports/inbox",
    metric: formatPercent(metrics.replyRate),
  },
  {
    title: "Automation flows",
    description: "Enrollment, completion rates, and message volume.",
    href: "/reports/automations",
    metric: "3 active",
  },
  {
    title: "Link tracking",
    description: "Click-through rates and top-performing links.",
    href: "/reports/links",
    metric: formatPercent(metrics.clickRate),
  },
  {
    title: "Usage & billing",
    description: "Credits consumed, segment costs, and balance.",
    href: "/reports/usage",
    metric: formatNumber(metrics.creditsRemaining),
  },
  {
    title: "Audit log",
    description: "Account activity, imports, and permission changes.",
    href: "/reports/audit-log",
    metric: "3 events",
  },
];

export default function ReportsOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Performance metrics across campaigns, messaging, contacts, and account activity."
        actions={
          <Link href="/reports/usage">
            <Button variant="outline">Export usage</Button>
          </Link>
        }
      />

      <Tabs items={reportTabs} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Messages sent"
          value={formatNumber(metrics.messagesSentPeriod)}
          hint="Current billing period"
          href="/reports/messages"
        />
        <StatCard
          label="Delivery rate"
          value={formatPercent(metrics.deliveryRate)}
          href="/reports/messages"
        />
        <StatCard
          label="Reply rate"
          value={formatPercent(metrics.replyRate)}
          href="/reports/inbox"
        />
        <StatCard
          label="Click rate"
          value={formatPercent(metrics.clickRate)}
          href="/reports/links"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Contact growth"
          value={`+${formatNumber(metrics.contactGrowth)}`}
          hint={`Opt-out ${formatPercent(metrics.optOutRate)}`}
          href="/reports/contacts"
        />
        <StatCard label="Credits remaining" value={formatNumber(metrics.creditsRemaining)} href="/reports/usage" />
        <StatCard label="A2P status" value={metrics.a2pStatus} href="/compliance" />
        <StatCard label="Active number" value={metrics.activeNumber} href="/numbers" />
      </div>

      <Card className="mt-6">
        <CardTitle>Drill-down reports</CardTitle>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {drillDowns.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start justify-between gap-3 rounded-lg border border-border p-4 transition hover:border-primary/40 hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-display text-lg font-semibold text-primary">{item.metric}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
