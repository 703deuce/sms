import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import {
  campaigns,
  complianceOverview,
  conversations,
  gettingStartedSteps,
  metrics,
  nextActions,
} from "@/lib/mock/data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const doneCount = gettingStartedSteps.filter((s) => s.done).length;
  const recentCampaigns = campaigns.slice(0, 4);
  const recentConversations = conversations.slice(0, 3);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Account health, registration status, and the next actions that move you to first send."
        actions={
          <>
            <Link href="/getting-started">
              <Button variant="outline">Getting started</Button>
            </Link>
            <Link href="/send">
              <Button>New campaign</Button>
            </Link>
          </>
        }
      />

      {metrics.a2pStatus !== "Approved" ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-medium text-amber-950">A2P registration is {metrics.a2pStatus.toLowerCase()}</p>
              <p className="text-sm text-amber-900/80">
                Complete brand and campaign registration before high-volume sending. Toll-free is{" "}
                {complianceOverview.tollFree.toLowerCase()}.
              </p>
            </div>
          </div>
          <Link href="/compliance">
            <Button variant="outline" className="border-amber-300 bg-white">
              Open compliance
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="A2P status"
          value={metrics.a2pStatus}
          hint="Brand & campaign registration"
          href="/compliance"
        />
        <StatCard
          label="Active number"
          value={metrics.activeNumber}
          hint="Default sending number"
          href="/numbers"
        />
        <StatCard
          label="Credits remaining"
          value={formatNumber(metrics.creditsRemaining)}
          hint={`Balance ${formatCurrency(metrics.balance)}`}
          href="/settings/billing"
        />
        <StatCard
          label="Sent this period"
          value={formatNumber(metrics.messagesSentPeriod)}
          hint="Billing period outbound"
          href="/reports/usage"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Delivery rate" value={formatPercent(metrics.deliveryRate)} href="/reports/messages" />
        <StatCard label="Reply rate" value={formatPercent(metrics.replyRate)} href="/reports/inbox" />
        <StatCard label="Click rate" value={formatPercent(metrics.clickRate)} href="/reports/links" />
        <StatCard
          label="Contact growth"
          value={`+${formatNumber(metrics.contactGrowth)}`}
          hint={`Opt-out ${formatPercent(metrics.optOutRate)}`}
          href="/reports/contacts"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardTitle>Recommended next actions</CardTitle>
          <ul className="mt-4 space-y-3">
            {nextActions.map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  className="group flex items-start justify-between gap-3 rounded-lg border border-border p-3 transition hover:border-primary/40"
                >
                  <div>
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between">
            <CardTitle>Getting started</CardTitle>
            <span className="text-xs text-muted-foreground">
              {doneCount}/{gettingStartedSteps.length} complete
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(doneCount / gettingStartedSteps.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {gettingStartedSteps.map((step) => (
              <li key={step.id}>
                {step.href && !step.done ? (
                  <Link
                    href={step.href}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span>{step.label}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={step.done ? "text-muted-foreground" : ""}>{step.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Recent campaigns</CardTitle>
            <Link href="/campaigns" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentCampaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.audience} · {formatNumber(c.sent)} sent
                  </p>
                </div>
                <StatusChip status={c.status} />
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Recent conversations</CardTitle>
            <Link href="/inbox" className="text-xs font-medium text-primary hover:underline">
              Open inbox
            </Link>
          </div>
          <div className="space-y-3">
            {recentConversations.map((c) => (
              <Link
                key={c.id}
                href="/inbox"
                className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {c.contactName}
                    {c.unread ? (
                      <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary" />
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                </div>
                <StatusChip status={c.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Account alerts</CardTitle>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {complianceOverview.requiredActions.map((a) => (
              <li key={a} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                {a}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Automation activity</CardTitle>
          <p className="mt-3 text-sm text-muted-foreground">
            Welcome series enrolled 18 contacts this week. Missed-call text-back sent 12 replies.
          </p>
          <Link href="/automations" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
            Review flows
          </Link>
        </Card>
      </div>
    </div>
  );
}
