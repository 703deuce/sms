import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared Personal product surface — matches mockup cards and spacing */
export const pCard =
  "rounded-xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

export const pMuted = "text-[13px] text-[#6b7280]";
export const pTitle = "text-[22px] font-bold tracking-tight text-[#111827]";
export const pSubtitle = "mt-1 text-[14px] text-[#6b7280]";

export function PersonalPageWrap({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1320px]">
      <div className={cn(aside ? "grid gap-6 lg:grid-cols-[1fr_300px]" : "")}>
        <div className="min-w-0 space-y-6">{children}</div>
        {aside ? <aside className="space-y-4">{aside}</aside> : null}
      </div>
    </div>
  );
}

export function PersonalPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className={pTitle}>{title}</h1>
        {description ? <p className={pSubtitle}>{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PersonalStatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass = "bg-[#eef2ff] text-[#6366f1]",
  href,
  hrefLabel,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  iconClass?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className={cn(pCard, "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-[#6b7280]">{label}</p>
          <p className="mt-1 text-[26px] font-bold leading-none text-[#111827]">{value}</p>
          {sub ? <p className="mt-1 text-[11px] text-[#9ca3af]">{sub}</p> : null}
          {href && hrefLabel ? (
            <a href={href} className="mt-2 inline-block text-[12px] font-semibold text-[#6366f1]">
              {hrefLabel}
            </a>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            iconClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function PersonalStatusBadge({
  status,
}: {
  status: "protected" | "warning" | "active" | "inactive" | "new" | "neutral";
}) {
  const map = {
    protected: "bg-[#ecfdf5] text-[#059669]",
    warning: "bg-[#fffbeb] text-[#d97706]",
    active: "bg-[#ecfdf5] text-[#059669]",
    inactive: "bg-[#f3f4f6] text-[#6b7280]",
    new: "bg-[#eef2ff] text-[#6366f1]",
    neutral: "bg-[#f3f4f6] text-[#374151]",
  };
  const labels = {
    protected: "Protected",
    warning: "Warning",
    active: "Active",
    inactive: "Inactive",
    new: "New",
    neutral: "—",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        map[status],
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "warning" ? "bg-[#f59e0b]" : status === "active" || status === "protected" ? "bg-[#10b981]" : "bg-[#9ca3af]",
        )}
      />
      {labels[status]}
    </span>
  );
}

export function PersonalSection({
  title,
  description,
  children,
  action,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className={cn(pCard, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f3f4f6] px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111827]">{title}</h2>
          {description ? <p className="mt-0.5 text-[12px] text-[#6b7280]">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function PersonalAsideCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={cn(pCard, "p-4")}>
      <h3 className="text-[13px] font-semibold text-[#111827]">{title}</h3>
      <div className="mt-3 space-y-3 text-[12px] text-[#6b7280]">{children}</div>
    </div>
  );
}

export function PersonalPrimaryButton({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-[#6366f1] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5558e8]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PersonalOutlineButton({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white px-4 text-[13px] font-semibold text-[#374151] hover:bg-[#f9fafb]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
