import { Button } from "@/components/ui/button";
import {
  campaigns,
  complianceOverview,
  conversations,
  gettingStartedSteps,
  metrics,
  nextActions,
} from "@/lib/mock/data";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  Coins,
  FileWarning,
  Megaphone,
  Phone,
  Send,
  Shield,
  Activity,
  Users,
} from "lucide-react";
import Link from "next/link";

function Sparkline({
  points,
  color,
  width = 88,
  height = 28,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

const avatarByName: Record<string, string> = {
  "Maya Chen": "/avatars/maya.svg",
  "Luis Ortiz": "/avatars/luis.svg",
  "Priya Shah": "/avatars/priya.svg",
  "James Wilson": "/avatars/james.svg",
};

const campaignIcons: Record<string, string> = {
  Completed: "bg-emerald-50 text-emerald-600",
  Scheduled: "bg-blue-50 text-blue-600",
  Draft: "bg-slate-100 text-slate-500",
  Failed: "bg-rose-50 text-rose-600",
  Sending: "bg-amber-50 text-amber-600",
};

const statusTone: Record<string, string> = {
  Completed: "bg-emerald-50 text-emerald-700",
  Scheduled: "bg-blue-50 text-blue-700",
  Draft: "bg-slate-100 text-slate-600",
  Failed: "bg-rose-50 text-rose-700",
  Open: "bg-emerald-50 text-emerald-700",
  Pending: "bg-amber-50 text-amber-700",
  Closed: "bg-slate-100 text-slate-600",
};

const nextActionIcons = [
  { icon: Shield, tone: "bg-emerald-50 text-emerald-600" },
  { icon: Users, tone: "bg-blue-50 text-blue-600" },
  { icon: Megaphone, tone: "bg-violet-50 text-violet-600" },
];

const conversationMeta: Record<
  string,
  { time: string; dot: string; actionLabel: string; actionTone: string }
> = {
  "Maya Chen": {
    time: "10:24 AM",
    dot: "bg-emerald-500",
    actionLabel: "Open",
    actionTone: "text-emerald-700 bg-emerald-50",
  },
  "Luis Ortiz": {
    time: "9:42 AM",
    dot: "bg-emerald-500",
    actionLabel: "Open",
    actionTone: "text-emerald-700 bg-emerald-50",
  },
  "Priya Shah": {
    time: "Yesterday",
    dot: "bg-amber-500",
    actionLabel: "Pending",
    actionTone: "text-amber-700 bg-amber-50",
  },
  "James Wilson": {
    time: "Yesterday",
    dot: "bg-slate-400",
    actionLabel: "Closed",
    actionTone: "text-slate-600 bg-slate-100",
  },
};

export default function DashboardPage() {
  const doneCount = gettingStartedSteps.filter((s) => s.done).length;
  const recentCampaigns = campaigns.slice(0, 4);
  const recentConversations = conversations.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[12px] border border-amber-200/80 bg-[#fff8e8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-[13px] font-semibold text-amber-950">
              A2P registration is pending
            </p>
            <p className="mt-0.5 text-[12px] text-amber-900/80">
              Complete brand and campaign registration before high-volume sending.
              Toll-free is {complianceOverview.tollFree.toLowerCase()}.
            </p>
          </div>
        </div>
        <Link href="/compliance">
          <Button
            variant="outline"
            className="h-9 rounded-[10px] border-amber-300 bg-white text-[13px]"
          >
            Open compliance
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/compliance" className="surface rounded-[12px] bg-card p-4 transition hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-muted-foreground">A2P Status</p>
              <p className="mt-2 text-[22px] font-bold tracking-tight">{metrics.a2pStatus}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Brand & campaign registration</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-violet-50 text-violet-600">
              <Shield className="h-5 w-5" />
            </span>
          </div>
        </Link>

        <Link href="/numbers" className="surface rounded-[12px] bg-card p-4 transition hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-muted-foreground">Active Number</p>
              <p className="mt-2 text-[20px] font-bold tracking-tight">{metrics.activeNumber}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Default sending number</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-blue-50 text-blue-600">
              <Phone className="h-5 w-5" />
            </span>
          </div>
        </Link>

        <Link href="/settings/billing" className="surface rounded-[12px] bg-card p-4 transition hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-muted-foreground">Credits Remaining</p>
              <p className="mt-2 text-[22px] font-bold tracking-tight">
                {formatNumber(metrics.creditsRemaining)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Balance {formatCurrency(metrics.balance)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600">
                <Coins className="h-5 w-5" />
              </span>
              <Sparkline points={[10, 12, 11, 14, 13, 16, 15, 18]} color="#10b981" />
            </div>
          </div>
        </Link>

        <Link href="/reports/usage" className="surface rounded-[12px] bg-card p-4 transition hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-muted-foreground">Sent This Period</p>
              <p className="mt-2 text-[22px] font-bold tracking-tight">
                {formatNumber(metrics.messagesSentPeriod)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Billing period outbound</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-orange-50 text-orange-600">
                <Send className="h-5 w-5" />
              </span>
              <Sparkline points={[8, 9, 12, 11, 14, 13, 15, 17]} color="#f97316" />
            </div>
          </div>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Delivery Rate",
            value: formatPercent(metrics.deliveryRate),
            delta: "+2.1%",
            color: "#10b981",
            points: [12, 13, 12, 15, 14, 16, 17, 18],
            href: "/reports/messages",
          },
          {
            label: "Reply Rate",
            value: formatPercent(metrics.replyRate),
            delta: "+1.4%",
            color: "#3b82f6",
            points: [8, 9, 10, 9, 11, 12, 11, 13],
            href: "/reports/inbox",
          },
          {
            label: "Click Rate",
            value: formatPercent(metrics.clickRate),
            delta: "+3.7%",
            color: "#8b5cf6",
            points: [6, 8, 7, 10, 12, 11, 14, 15],
            href: "/reports/links",
          },
          {
            label: "Contact Growth",
            value: `+${formatNumber(metrics.contactGrowth)}`,
            delta: "+0.6%",
            color: "#10b981",
            points: [4, 6, 5, 8, 9, 11, 12, 14],
            href: "/reports/contacts",
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="surface rounded-[12px] bg-card p-4 transition hover:shadow-md"
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-2 text-[22px] font-bold tracking-tight">{card.value}</p>
                <p className="mt-1 text-[12px] font-semibold text-emerald-600">{card.delta}</p>
              </div>
              <Sparkline points={card.points} color={card.color} />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="surface rounded-[12px] bg-card p-5 xl:col-span-5">
          <h3 className="text-[14px] font-bold text-foreground">Recommended next actions</h3>
          <ul className="mt-4 space-y-3">
            {nextActions.map((action, i) => {
              const meta = nextActionIcons[i] ?? nextActionIcons[0];
              const Icon = meta.icon;
              return (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="group flex items-start gap-3 rounded-[12px] border border-border p-3 transition hover:border-primary/30 hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
                        meta.tone,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-foreground">
                        {action.title}
                      </span>
                      <span className="mt-1 block text-[12px] text-muted-foreground">
                        {action.description}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="surface rounded-[12px] bg-card p-5 xl:col-span-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-bold text-foreground">Getting started</h3>
            <span className="text-[12px] font-medium text-muted-foreground">
              {doneCount}/{gettingStartedSteps.length} complete
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(doneCount / gettingStartedSteps.length) * 100}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {gettingStartedSteps.map((step) => (
              <li key={step.id}>
                {step.href && !step.done ? (
                  <Link
                    href={step.href}
                    className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] hover:bg-muted"
                  >
                    <Circle className="h-4 w-4 text-muted-foreground" />
                    <span>{step.label}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px]">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={step.done ? "text-muted-foreground" : ""}>{step.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="surface rounded-[12px] bg-card p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-foreground">Recent campaigns</h3>
            <Link href="/campaigns" className="text-[12px] font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentCampaigns.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="flex items-center gap-3 rounded-[12px] border border-border px-3 py-2.5 transition hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
                    campaignIcons[c.status] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  <Megaphone className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{c.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {c.audience} · {formatNumber(c.sent)} sent
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    statusTone[c.status] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {c.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="surface rounded-[12px] bg-card p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-foreground">Recent conversations</h3>
            <Link href="/inbox" className="text-[12px] font-semibold text-primary hover:underline">
              Open inbox
            </Link>
          </div>
          <div className="space-y-3">
            {recentConversations.map((c) => {
              const meta = conversationMeta[c.contactName] ?? {
                time: "Today",
                dot: "bg-emerald-500",
                actionLabel: c.status,
                actionTone: statusTone[c.status] ?? "bg-muted text-muted-foreground",
              };
              const src = avatarByName[c.contactName] ?? "/avatars/alex.svg";
              return (
                <Link
                  key={c.id}
                  href="/inbox"
                  className="flex items-center gap-3 rounded-[12px] border border-border px-3 py-2.5 transition hover:bg-muted/40"
                >
                  <span className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={c.contactName}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                        meta.dot,
                      )}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold">{c.contactName}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{meta.time}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                      {c.lastMessage}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                      meta.actionTone,
                    )}
                  >
                    {meta.actionLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <div className="surface rounded-[12px] bg-card p-5">
            <h3 className="text-[14px] font-bold text-foreground">Account alerts</h3>
            <ul className="mt-3 space-y-2.5">
              {complianceOverview.requiredActions.map((a) => (
                <li key={a} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
                  <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="surface rounded-[12px] bg-card p-5">
            <h3 className="text-[14px] font-bold text-foreground">Automation activity</h3>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Welcome series enrolled 18 contacts this week. Missed-call text-back sent 12 replies.
            </p>
            <Link
              href="/automations"
              className="mt-4 flex items-center justify-between rounded-[12px] border border-border bg-muted/40 px-3 py-3 transition hover:border-primary/30"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-600">
                  <Activity className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-foreground">
                    Welcome Series
                  </span>
                  <span className="text-[11px] text-muted-foreground">Active · 18 enrolled</span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
