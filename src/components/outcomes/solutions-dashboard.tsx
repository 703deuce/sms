import type { SolutionsDashboardData } from "@/lib/outcomes/dashboard-data";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarDays,
  Inbox,
  Mail,
  MessageSquare,
  Moon,
  Phone,
  PhoneMissed,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const iconMap = {
  "phone-missed": PhoneMissed,
  moon: Moon,
  calendar: CalendarDays,
  mail: Mail,
  star: Star,
  message: MessageSquare,
  phone: Phone,
  inbox: Inbox,
} as const;

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "active" | "pending" | "not_setup" | "draft" | "info";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        tone === "active" && "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
        tone === "pending" && "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
        (tone === "not_setup" || tone === "draft") &&
          "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
        tone === "info" && "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
      )}
    >
      {label}
    </span>
  );
}

function ActionButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "soft";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg px-3.5 text-[13px] font-semibold transition",
        variant === "primary" &&
          "bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8]",
        variant === "outline" &&
          "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "soft" &&
          "bg-slate-100 text-slate-700 hover:bg-slate-200",
      )}
    >
      {children}
    </Link>
  );
}

export function SolutionsDashboardView({ data }: { data: SolutionsDashboardData }) {
  return (
    <div className="mx-auto max-w-[1180px] space-y-7">
      {/* Hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-slate-900">
            Solutions Dashboard
          </h2>
          <p className="mt-1.5 max-w-xl text-[15px] text-slate-500">
            Choose how you want Transovo to handle your business communications.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/outcomes/custom-automation"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Add new solution
          </Link>
          <Link
            href="/outcomes/missed-overflow"
            className="inline-flex h-10 items-center rounded-lg bg-[#2563eb] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
          >
            Get Started
          </Link>
        </div>
      </div>

      {/* Featured solutions */}
      <section>
        <div className="mb-3.5 flex items-end justify-between gap-3">
          <h3 className="text-[17px] font-bold tracking-tight text-slate-900">
            What do you want Transovo to handle?
          </h3>
          <Link
            href="/outcomes/answer-every-call"
            className="text-[13px] font-semibold text-[#2563eb] hover:underline"
          >
            View all solutions
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.featured.map((card) => {
            const Icon = iconMap[card.icon];
            return (
              <div
                key={card.slug}
                className="flex min-h-[188px] flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full",
                      card.iconTone,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <StatusPill
                    label={card.statusLabel}
                    tone={card.status === "not_setup" ? "not_setup" : card.status}
                  />
                </div>
                <h4 className="mt-4 text-[16px] font-bold tracking-tight text-slate-900">
                  {card.title}
                </h4>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-500">
                  {card.description}
                </p>
                <div className="mt-4 flex justify-end">
                  <ActionButton
                    href={card.href}
                    variant={card.status === "active" ? "outline" : "primary"}
                  >
                    {card.actionLabel}
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Middle row */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
          <h3 className="text-[15px] font-bold text-slate-900">Needs Attention</h3>
          <ul className="mt-4 space-y-3">
            {data.attention.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-3"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    item.tone === "danger" && "bg-rose-100 text-rose-600",
                    item.tone === "warning" && "bg-amber-100 text-amber-600",
                    item.tone === "info" && "bg-sky-100 text-sky-600",
                  )}
                >
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">{item.title}</p>
                  {item.detail ? (
                    <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                      {item.detail}
                    </p>
                  ) : null}
                </div>
                <ActionButton href={item.href} variant="outline">
                  {item.actionLabel}
                </ActionButton>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
          <h3 className="text-[15px] font-bold text-slate-900">Your Active Solutions</h3>
          <ul className="mt-4 space-y-3">
            {data.activeSolutions.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-900">
                    {row.label}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {row.solutionTitle}
                  </p>
                </div>
                <StatusPill
                  label={row.status}
                  tone={row.statusTone === "pending" ? "pending" : "active"}
                />
                <ActionButton
                  href={row.href}
                  variant={row.statusTone === "pending" ? "primary" : "outline"}
                >
                  {row.actionLabel}
                </ActionButton>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-slate-900">Recent Activity</h3>
            <div className="flex gap-1">
              {["All", "Calls", "Messages"].map((filter, i) => (
                <span
                  key={filter}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    i === 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>
          <ul className="mt-4 space-y-3.5">
            {data.activity.map((row) => (
              <li key={row.id}>
                <Link href={row.href} className="group flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2563eb]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-900 group-hover:text-[#2563eb]">
                        {row.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">{row.when}</span>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      {row.detail}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recommended next */}
      <section>
        <h3 className="mb-3.5 text-[17px] font-bold tracking-tight text-slate-900">
          Recommended Next
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {data.recommended.map((card) => (
            <div
              key={card.slug}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]"
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  card.iconTone,
                )}
              >
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-900">{card.title}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                  {card.reason}
                </p>
              </div>
              <ActionButton href={card.href} variant="soft">
                Add
              </ActionButton>
            </div>
          ))}
        </div>
      </section>

      {/* This week */}
      <section className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <h3 className="shrink-0 text-[15px] font-bold text-slate-900">This Week</h3>
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.weekStats.map((stat) => {
              const Icon = iconMap[stat.icon];
              return (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2563eb] shadow-sm ring-1 ring-slate-100">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[18px] font-bold tracking-tight text-slate-900">
                      {stat.value}
                    </p>
                    <p className="text-[12px] text-slate-500">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
