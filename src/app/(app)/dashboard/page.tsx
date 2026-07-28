import { Button } from "@/components/ui/button";
import { teamMembers } from "@/lib/mock/data";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  FileCheck2,
  Phone,
  Users,
  UserPlus,
  ShieldCheck,
  BarChart3,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

function Sparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  const width = 120;
  const height = 36;
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
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

const metricCards = [
  {
    label: "A2P Registration",
    value: "Pending",
    hint: "Submit 10DLC registration application",
    href: "/compliance",
    icon: FileCheck2,
    tone: "bg-[#efe7ff] text-[#7c3aed]",
  },
  {
    label: "Phone Number",
    value: "(+123) 456-6789",
    hint: "Main booking number",
    href: "/numbers",
    icon: Phone,
    tone: "bg-[#e8f1ff] text-[#2563eb]",
  },
  {
    label: "Active Members",
    value: "3,429",
    hint: "View members list",
    href: "/contacts",
    icon: Users,
    tone: "bg-[#e7f8f1] text-[#059669]",
  },
  {
    label: "Leads Generated",
    value: "1,500",
    hint: "View performance metrics",
    href: "/reports",
    icon: UserPlus,
    tone: "bg-[#fff1e8] text-[#ea580c]",
  },
];

const trendCards = [
  {
    label: "Conversion Rate",
    value: "$1.45k",
    delta: "+1.2%",
    up: true,
    color: "#10b981",
    points: [8, 10, 9, 12, 11, 14, 13, 16, 15, 18],
  },
  {
    label: "Revenue",
    value: "15.6%",
    delta: "-0.3%",
    up: false,
    color: "#3b82f6",
    points: [14, 12, 15, 13, 16, 12, 14, 11, 13, 12],
  },
  {
    label: "Active Users",
    value: "15.2%",
    delta: "+2.5%",
    up: true,
    color: "#8b5cf6",
    points: [6, 8, 7, 10, 9, 12, 11, 14, 13, 16],
  },
  {
    label: "Lead Value",
    value: "+25k",
    delta: "+4.8%",
    up: true,
    color: "#f97316",
    points: [5, 7, 6, 9, 10, 12, 11, 14, 15, 18],
  },
];

const nextSteps = [
  {
    title: "Setup multi-factor authentication",
    meta: "Security · 10 pts",
    href: "/settings/security",
    icon: ShieldCheck,
    tone: "bg-[#efe7ff] text-[#7c3aed]",
  },
  {
    title: "Review campaign performance",
    meta: "Analytics · 8 pts",
    href: "/reports/campaigns",
    icon: BarChart3,
    tone: "bg-[#e8f1ff] text-[#2563eb]",
  },
  {
    title: "Finish A2P brand registration",
    meta: "Compliance · 15 pts",
    href: "/compliance/brand",
    icon: FileCheck2,
    tone: "bg-[#fff1e8] text-[#ea580c]",
  },
  {
    title: "Import opted-in contacts",
    meta: "Growth · 12 pts",
    href: "/contacts/imports",
    icon: Users,
    tone: "bg-[#e7f8f1] text-[#059669]",
  },
];

const recentActivities = [
  { name: "Maya Chen", time: "2 min ago", status: "In Progress", tone: "bg-blue-50 text-blue-700" },
  { name: "Luis Ortiz", time: "18 min ago", status: "Completed", tone: "bg-emerald-50 text-emerald-700" },
  { name: "Priya Shah", time: "1 hr ago", status: "In Progress", tone: "bg-blue-50 text-blue-700" },
  { name: "Sam Patel", time: "3 hr ago", status: "Completed", tone: "bg-emerald-50 text-emerald-700" },
];

const announcements = [
  { title: "A2P review window extended", date: "Oct 12" },
  { title: "New automation templates live", date: "Oct 08" },
  { title: "Billing cycle closes Oct 31", date: "Oct 01" },
];

const teamBars = [
  { name: "John Doe", value: 86 },
  { name: "Jordan Lee", value: 72 },
  { name: "Sam Patel", value: 64 },
  { name: "Casey Nguyen", value: 48 },
];

export default function DashboardPage() {
  const checklist = [
    { id: 1, label: "Setup account", done: true },
    { id: 2, label: "Connect domain", done: true },
    { id: 3, label: "Add business details", done: true },
    { id: 4, label: "Import contacts", done: false, href: "/contacts/imports" },
    { id: 5, label: "Launch first campaign", done: false, href: "/send" },
  ];
  const doneCount = checklist.filter((s) => s.done).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2.5 rounded-[10px] border border-amber-200/80 bg-[#fff8e8] px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[13px] leading-relaxed text-amber-950">
            <span className="font-semibold">A2P registration is pending.</span>{" "}
            Complete conversion tracking registration before high volume mailing.{" "}
            <Link href="/compliance" className="font-semibold text-amber-900 underline underline-offset-2">
              Link your accounts.
            </Link>
          </p>
        </div>
        <Link
          href="/compliance"
          className="shrink-0 text-[13px] font-semibold text-amber-900 hover:underline"
        >
          View details
        </Link>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[20px] font-bold tracking-tight text-foreground">Dashboard</h2>
        <div className="flex items-center gap-3">
          <Link
            href="/getting-started"
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            Strategy guide
          </Link>
          <Link href="/send">
            <Button className="h-9 rounded-[10px] px-4 text-[13px] font-semibold shadow-[0_8px_18px_rgba(16,185,129,0.25)]">
              Run Campaign
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="surface rounded-[12px] bg-card p-3.5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-1.5 text-[20px] font-bold tracking-tight text-foreground">
                    {card.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{card.hint}</p>
                </div>
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-[10px]",
                    card.tone,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {trendCards.map((card) => (
          <div key={card.label} className="surface rounded-[12px] bg-card p-3.5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
                <p className="mt-1.5 text-[20px] font-bold tracking-tight">{card.value}</p>
                <p
                  className={cn(
                    "mt-1 text-[12px] font-semibold",
                    card.up ? "text-emerald-600" : "text-rose-500",
                  )}
                >
                  {card.delta}
                </p>
              </div>
              <Sparkline points={card.points} color={card.color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="surface rounded-[12px] bg-card p-4 xl:col-span-3">
          <h3 className="text-[14px] font-bold text-foreground">Recommended next steps</h3>
          <ul className="mt-3 space-y-2">
            {nextSteps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <Link
                    href={step.href}
                    className="flex items-start gap-2.5 rounded-[10px] p-1.5 transition hover:bg-muted/70"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                        step.tone,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold leading-snug text-foreground">
                        {step.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {step.meta}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="surface rounded-[12px] bg-card p-4 xl:col-span-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-foreground">Getting started</h3>
            <span className="text-[11px] font-medium text-muted-foreground">
              {doneCount}/{checklist.length} complete
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(doneCount / checklist.length) * 100}%` }}
            />
          </div>
          <ul className="mt-3 space-y-2">
            {checklist.map((step) => (
              <li key={step.id} className="flex items-center gap-2.5 text-[12px]">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                {step.href && !step.done ? (
                  <Link href={step.href} className="hover:text-primary">
                    {step.label}
                  </Link>
                ) : (
                  <span className={step.done ? "text-muted-foreground" : ""}>{step.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface rounded-[12px] bg-card p-4 xl:col-span-3">
          <h3 className="text-[14px] font-bold text-foreground">Recent activities</h3>
          <ul className="mt-3 space-y-2.5">
            {recentActivities.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground">{item.time}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    item.tone,
                  )}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface rounded-[12px] bg-card p-4 xl:col-span-3">
          <h3 className="text-[14px] font-bold text-foreground">Team performance</h3>
          <ul className="mt-3 space-y-3">
            {teamBars.map((member, i) => (
              <li key={member.name}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground">
                      {member.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")}
                    </span>
                    <span className="text-[12px] font-medium">{member.name}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{member.value}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      i % 2 === 0 ? "bg-primary" : "bg-blue",
                    )}
                    style={{ width: `${member.value}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="surface rounded-[12px] bg-card p-4 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-foreground">Announcements</h3>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <ul className="mt-3 divide-y divide-border">
            {announcements.map((item) => (
              <li
                key={item.title}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                <span className="text-[12px] text-muted-foreground">{item.date}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="surface rounded-[12px] bg-card p-4 lg:col-span-4">
          <h3 className="text-[14px] font-bold text-foreground">Performance summary</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">Weekly Trend</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[28px] font-bold tracking-tight text-foreground">15%</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5" />
                increase
              </p>
            </div>
            <Sparkline
              points={[4, 6, 5, 8, 7, 10, 12, 11, 14, 16]}
              color="#10b981"
            />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
            Campaign replies and contact growth are up versus last week across{" "}
            {teamMembers.length} active teammates.
          </p>
        </div>
      </div>
    </div>
  );
}
