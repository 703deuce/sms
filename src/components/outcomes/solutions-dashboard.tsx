import type {
  FeaturedBadge,
  SolutionsDashboardData,
} from "@/lib/outcomes/dashboard-data";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CalendarDays,
  Clock3,
  MessageSquare,
  Moon,
  Phone,
  PhoneMissed,
  Plus,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";

const iconMap = {
  "phone-missed": PhoneMissed,
  moon: Moon,
  calendar: CalendarDays,
  welcome: Banknote,
  sparkles: Sparkles,
  reactivate: Banknote,
  phone: Phone,
  star: Star,
  clock: Clock3,
  users: Users,
  mail: MessageSquare,
} as const;

function StatusBadge({
  badge,
  label,
}: {
  badge: FeaturedBadge;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold leading-none",
        badge === "active" && "bg-[#EFF6FF] text-[#2563EB]",
        badge === "recommended" && "bg-violet-100 text-violet-700",
        badge === "new" && "bg-emerald-50 text-emerald-700",
        badge === "hot" && "bg-amber-50 text-amber-700",
      )}
    >
      {label}
    </span>
  );
}

export function SolutionsDashboardView({ data }: { data: SolutionsDashboardData }) {
  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[640px]">
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#111827]">
            Solutions Dashboard
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#6B7280]">
            Centralized view of everything Transovo is doing for you and your
            patients.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/outcomes/custom-automation"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#3B82F6] bg-white px-3.5 text-[13px] font-semibold text-[#3B82F6] hover:bg-[#EFF6FF]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Solution
          </Link>
          <Link
            href="/outcomes/answer-every-call"
            className="inline-flex h-9 items-center rounded-lg bg-[#3B82F6] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#2563EB]"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Featured grid */}
      <section>
        <h3 className="mb-3.5 text-[16px] font-bold tracking-tight text-[#111827]">
          What do you want Transovo to handle?
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.featured.map((card) => {
            const Icon = iconMap[card.icon];
            return (
              <div
                key={card.slug}
                className="flex min-h-[168px] flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
                      card.iconTone,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[15px] font-bold tracking-tight text-[#111827]">
                        {card.title}
                      </h4>
                      <StatusBadge badge={card.badge} label={card.badgeLabel} />
                    </div>
                    <div className="mt-2.5 flex items-center gap-4 text-[12px] font-medium text-[#6B7280]">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3 w-3 text-[#9CA3AF]" />
                        {card.metricPrimary}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3 w-3 text-[#9CA3AF]" />
                        {card.metricSecondary}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex justify-end pt-4">
                  <Link
                    href={card.href}
                    className="inline-flex h-8 items-center rounded-md bg-[#F3F4F6] px-3 text-[12px] font-semibold text-[#374151] hover:bg-[#E5E7EB]"
                  >
                    {card.actionLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Middle row — three separate panels */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Active Solutions */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111827]">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Active Solutions
            </h3>
            <Link
              href="/outcomes/answer-every-call"
              className="text-[12px] font-semibold text-[#3B82F6] hover:underline"
            >
              View All
            </Link>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.activeSolutions.map((row) => {
              const Icon = iconMap[row.icon];
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 px-5 py-3.5"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        row.iconTone,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#111827]">
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-[#6B7280]">
                        {row.description}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={row.href}
                    className="shrink-0 text-[12px] font-semibold text-[#3B82F6] hover:underline"
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* The Latest Statistics */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111827]">
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#DBEAFE] text-[#2563EB]">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
              The Latest Statistics
            </h3>
            <Link
              href="/reports"
              className="text-[12px] font-semibold text-[#3B82F6] hover:underline"
            >
              View All
            </Link>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-[#E5E7EB] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CA3AF]">
            <span>Service</span>
            <span>Update</span>
            <span className="text-right">Last Activity</span>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.statistics.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-5 py-3"
              >
                <span className="truncate text-[13px] font-semibold text-[#111827]">
                  {row.service}
                </span>
                <span
                  className={cn(
                    "text-[12px] font-semibold",
                    row.trendTone === "up" && "text-emerald-600",
                    row.trendTone === "down" && "text-rose-500",
                  )}
                >
                  {row.update}
                </span>
                <span className="text-right text-[11px] text-[#9CA3AF]">
                  {row.lastActivity}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-4">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#111827]">
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-emerald-100 text-emerald-600">
                <Phone className="h-2.5 w-2.5" />
              </span>
              Recent Activity
            </h3>
            <Link
              href="/integrations/native/leads"
              className="text-[12px] font-semibold text-[#3B82F6] hover:underline"
            >
              View All
            </Link>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.activity.map((row) => {
              const Icon = iconMap[row.icon];
              return (
                <li key={row.id}>
                  <Link
                    href={row.href}
                    className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          row.iconTone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-[13px] font-medium leading-snug text-[#111827]">
                        {row.title}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[11px] text-[#9CA3AF]">
                      {row.when}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Recommended Apps */}
      <section>
        <h3 className="mb-3.5 text-[16px] font-bold tracking-tight text-[#111827]">
          Recommended Apps
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {data.recommended.map((card) => {
            const Icon = iconMap[card.icon];
            return (
              <div
                key={card.slug}
                className="flex items-center gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    card.iconTone,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#111827]">
                    {card.title}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-[#6B7280]">
                    {card.description}
                  </span>
                </span>
                <Link
                  href={card.href}
                  className="inline-flex h-8 shrink-0 items-center rounded-md bg-[#F3F4F6] px-3 text-[12px] font-semibold text-[#374151] hover:bg-[#E5E7EB]"
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom stats */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.weekStats.map((stat) => {
          const Icon = iconMap[stat.icon];
          return (
            <div
              key={stat.label}
              className="relative overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                    stat.iconTone,
                  )}
                >
                  <Icon className="h-6 w-6 opacity-80" />
                </span>
                <div className="min-w-0">
                  <p className="text-[24px] font-bold tabular-nums leading-none tracking-tight text-[#111827]">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-[13px] font-semibold text-[#4B5563]">
                    {stat.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-[12px] font-medium",
                      stat.deltaTone === "up" && "text-emerald-600",
                      stat.deltaTone === "down" && "text-rose-500",
                      stat.deltaTone === "flat" && "text-[#9CA3AF]",
                    )}
                  >
                    {stat.deltaLabel}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
