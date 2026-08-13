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
        "inline-flex h-[22px] shrink-0 items-center rounded-md px-2 text-[11px] font-semibold leading-none",
        badge === "voice" && "bg-violet-100 text-violet-700",
        badge === "automated" && "bg-violet-50 text-violet-700",
        badge === "new" && "bg-violet-50 text-violet-700",
        badge === "running" && "bg-violet-50 text-violet-700",
        badge === "active" && "bg-violet-50 text-violet-700",
        badge === "recommended" && "bg-violet-100 text-violet-700",
        badge === "hot" && "bg-amber-50 text-amber-700",
      )}
    >
      {label}
    </span>
  );
}

function PrimaryBtn({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"
    >
      {children}
    </Link>
  );
}

function OutlineBtn({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-[#D1D5DB] bg-white px-3 text-[12px] font-semibold text-[#374151] hover:bg-[#F9FAFB]"
    >
      {children}
    </Link>
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
            Choose a solution below to start getting results for your business.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/outcomes/custom-automation"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3.5 text-[13px] font-semibold text-[#111827] hover:bg-[#F9FAFB]"
          >
            <Plus className="h-3.5 w-3.5" />
            New Solution
          </Link>
          <Link
            href="/voice/agents"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover"
          >
            Manage AI Voice
          </Link>
        </div>
      </div>

      {/* Featured grid */}
      <section>
        <h3 className="mb-3.5 text-[16px] font-bold tracking-tight text-[#111827]">
          What do you want Transovo to handle?
        </h3>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white",
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
                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-[#6B7280]">
                      {card.description}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                  <span className="text-[11px] font-medium text-[#9CA3AF]">
                    {card.channelLabel}
                  </span>
                  {card.actionVariant === "primary" ? (
                    <PrimaryBtn href={card.href}>{card.actionLabel}</PrimaryBtn>
                  ) : (
                    <OutlineBtn href={card.href}>{card.actionLabel}</OutlineBtn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Middle row — three separate panels */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* Active Solutions */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-3.5">
            <h3 className="text-[14px] font-bold text-[#111827]">
              Active Solutions
            </h3>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.activeSolutions.map((row) => {
              const Icon = iconMap[row.icon];
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                        row.iconTone,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="truncate text-[13px] font-semibold text-[#111827]">
                      {row.label}
                    </p>
                  </div>
                  <PrimaryBtn href={row.href}>Open</PrimaryBtn>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Top Active Solutions */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-3.5">
            <h3 className="text-[14px] font-bold text-[#111827]">
              Top Active Solutions
            </h3>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.topActive.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#111827]">
                    {row.label}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[12px] text-[#6B7280]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-violet-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                      {row.status}
                    </span>
                    <span className="text-[#9CA3AF]">{row.date}</span>
                  </p>
                </div>
                <OutlineBtn href={row.href}>Setup</OutlineBtn>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] px-5 py-3.5">
            <h3 className="text-[14px] font-bold text-[#111827]">
              Recent Activity
            </h3>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {data.activity.map((row) => {
              const Icon = iconMap[row.icon];
              return (
                <li key={row.id}>
                  <Link
                    href={row.href}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                          row.iconTone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate text-[13px] font-medium text-[#111827]">
                        {row.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-[#9CA3AF]">
                      {row.when}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Recommended Next */}
      <section>
        <h3 className="mb-3.5 text-[15px] font-bold tracking-tight text-[#111827]">
          Recommended Next
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
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
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#111827]">
                  {card.title}
                </span>
                <PrimaryBtn href={card.href}>Open</PrimaryBtn>
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
              <div className="flex items-center gap-3">
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
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
