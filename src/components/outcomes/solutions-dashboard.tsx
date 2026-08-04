import type {
  FeaturedBadge,
  SolutionsDashboardData,
} from "@/lib/outcomes/dashboard-data";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Mail,
  Moon,
  Phone,
  PhoneMissed,
  Plus,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";

const iconMap = {
  "phone-missed": PhoneMissed,
  moon: Moon,
  calendar: CalendarDays,
  mail: Mail,
  star: Star,
  welcome: Banknote,
  phone: Phone,
  users: Users,
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
        "inline-flex h-[22px] items-center rounded-full px-2.5 text-[11px] font-semibold leading-none",
        badge === "working" && "bg-emerald-50 text-emerald-700",
        badge === "ready" && "bg-[#EEF2FF] text-[#4F46E5]",
        badge === "active" && "bg-emerald-50 text-emerald-700",
        badge === "draft" && "bg-[#FFF7ED] text-[#C2410C]",
      )}
    >
      {label}
    </span>
  );
}

export function SolutionsDashboardView({ data }: { data: SolutionsDashboardData }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-[560px]">
          <h2 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#111827]">
            Solutions Dashboard
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-[#6B7280]">
            Quickly manage your AI and messaging solutions to drive results for
            your business.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/outcomes/answer-every-call"
            className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-semibold text-[#111827] shadow-sm hover:bg-slate-50"
          >
            View All Solutions
          </Link>
          <Link
            href="/outcomes/custom-automation"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3B82F6] px-3.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#2563EB]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Solution
          </Link>
        </div>
      </div>

      {/* Featured grid */}
      <section>
        <h3 className="mb-3 text-[16px] font-bold tracking-tight text-[#111827]">
          What do you want Transovo to handle?
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.featured.map((card) => {
            const Icon = iconMap[card.icon];
            const primaryAction =
              card.actionLabel === "Manage" ? "outline" : "primary";
            return (
              <div
                key={card.slug}
                className="flex min-h-[172px] flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      card.iconTone,
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <StatusBadge badge={card.badge} label={card.badgeLabel} />
                </div>
                <h4 className="mt-3.5 text-[15px] font-bold tracking-tight text-[#111827]">
                  {card.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-[#6B7280]">
                  {card.description}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-[#6B7280]">
                    <span>{card.metricPrimary}</span>
                    {card.metricSecondary ? (
                      <>
                        <span className="text-[#D1D5DB]">·</span>
                        <span>{card.metricSecondary}</span>
                      </>
                    ) : null}
                  </div>
                  <Link
                    href={card.href}
                    className={cn(
                      "inline-flex h-8 items-center rounded-lg px-3 text-[12px] font-semibold transition",
                      primaryAction === "primary"
                        ? "bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                        : "border border-[#E5E7EB] bg-white text-[#111827] hover:bg-slate-50",
                    )}
                  >
                    {card.actionLabel}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Middle row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-[14px] font-bold text-[#111827]">Needs Attention</h3>
          <ul className="mt-3.5 space-y-3">
            {data.attention.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    item.tone === "danger" && "bg-rose-100 text-rose-600",
                    item.tone === "warning" && "bg-orange-100 text-orange-600",
                    item.tone === "caution" && "bg-amber-100 text-amber-600",
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-medium text-[#111827]">
                  {item.title}
                </span>
                <Link
                  href={item.href}
                  className="shrink-0 text-[12px] font-semibold text-[#3B82F6] hover:underline"
                >
                  {item.actionLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-[14px] font-bold text-[#111827]">
            Top Active Solutions
          </h3>
          <ul className="mt-3.5 space-y-3.5">
            {data.activeSolutions.map((row) => {
              const Icon = iconMap[row.icon];
              return (
                <li key={row.id}>
                  <Link href={row.href} className="block rounded-md hover:bg-slate-50">
                    <div className="flex items-center gap-2.5 px-0.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          row.iconTone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#111827]">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-[11px] font-medium text-[#6B7280]">
                        {row.countLabel}
                      </span>
                    </div>
                    <div className="mt-1.5 ml-9 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
                      <div
                        className="h-full rounded-full bg-[#3B82F6]"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h3 className="text-[14px] font-bold text-[#111827]">Recent Activity</h3>
          <ul className="mt-3.5 space-y-3">
            {data.activity.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-start justify-between gap-3 rounded-md px-0.5 py-0.5 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                    <span className="text-[13px] font-medium leading-snug text-[#111827]">
                      {row.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-[#9CA3AF]">{row.when}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recommended Next */}
      <section>
        <h3 className="mb-3 text-[16px] font-bold tracking-tight text-[#111827]">
          Recommended Next
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
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    card.iconTone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#111827]">
                  {card.title}
                </span>
                <Link
                  href={card.href}
                  className="inline-flex h-8 shrink-0 items-center rounded-lg bg-[#3B82F6] px-3 text-[12px] font-semibold text-white hover:bg-[#2563EB]"
                >
                  Set Up
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
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#3B82F6]">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold leading-snug tracking-tight text-[#111827]">
                    <span className="text-[20px] tabular-nums">{stat.value}</span>{" "}
                    <span className="text-[13px] font-semibold text-[#4B5563]">
                      {stat.label}
                    </span>
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-[12px] font-medium",
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
