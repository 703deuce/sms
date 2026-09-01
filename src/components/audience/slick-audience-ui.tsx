import { cn, formatNumber } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

type SlickStatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "violet" | "green" | "rose";
  showInfo?: boolean;
  href?: string;
};

const toneStyles = {
  violet: {
    card: "border-violet-100 bg-violet-50/40",
    icon: "bg-violet-100 text-violet-600",
  },
  green: {
    card: "border-emerald-100 bg-emerald-50/40",
    icon: "bg-emerald-100 text-emerald-600",
  },
  rose: {
    card: "border-rose-100 bg-rose-50/40",
    icon: "bg-rose-100 text-rose-600",
  },
};

export function SlickStatCard({
  label,
  value,
  icon: Icon,
  tone,
  showInfo = false,
  href,
}: SlickStatCardProps) {
  const styles = toneStyles[tone];
  const content = (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border px-5 py-4",
        styles.card,
        href && "transition hover:shadow-sm",
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          styles.icon,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
          {label}
          {showInfo ? <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden /> : null}
        </div>
        <p className="mt-0.5 font-display text-[28px] font-semibold leading-none text-slate-900">
          {typeof value === "number" ? formatNumber(value) : value}
        </p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block no-underline">
        {content}
      </a>
    );
  }

  return content;
}

export function SlickAudienceHeader({
  breadcrumb,
  title,
  description,
  icon: Icon,
  actions,
}: {
  breadcrumb?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? (
          <p className="mb-1 text-[12px] font-medium text-primary">{breadcrumb}</p>
        ) : null}
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <h1 className="font-display text-[24px] font-semibold tracking-tight text-slate-900 sm:text-[26px]">
            {title}
          </h1>
        </div>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function SlickTableToolbar({
  searchPlaceholder = "Search",
  createLabel,
  createHref,
  onCreateClick,
  createSlot,
  filterSlot,
}: {
  searchPlaceholder?: string;
  createLabel?: string;
  createHref?: string;
  onCreateClick?: () => void;
  createSlot?: ReactNode;
  filterSlot?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 items-center gap-2">
        {filterSlot}
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <input
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
            placeholder={searchPlaceholder}
          />
        </div>
      </div>
      {createSlot ? (
        createSlot
      ) : createHref ? (
        <a
          href={createHref}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-white no-underline shadow-sm transition hover:bg-primary/90"
        >
          {createLabel}
        </a>
      ) : createLabel ? (
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          {createLabel}
        </button>
      ) : null}
    </div>
  );
}

export function SlickOptInBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const subscribed = normalized === "subscribed" || normalized === "active";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
        subscribed
          ? "bg-emerald-100 text-emerald-700"
          : "bg-rose-100 text-rose-700",
      )}
    >
      {subscribed ? "Subscribed" : status === "Unsubscribed" ? "Unsubscribed" : status}
    </span>
  );
}

export function formatSlickDateTime(date: string | null) {
  if (!date) return "—";
  const d = new Date(date);
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.getFullYear();
  const time = d
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `${month} ${day}${suffix}, ${year} @ ${time}`;
}
