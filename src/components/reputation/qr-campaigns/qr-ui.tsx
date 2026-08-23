import { cn } from "@/lib/utils";

/** Visual tokens from the Google Review QR mockups. */
export const qrUi = {
  green: "#16A34A",
  greenDark: "#15803D",
  greenSoft: "#ECFDF3",
  navy: "#0B1B32",
  navySoft: "#152A45",
  ink: "#101828",
  muted: "#667085",
  line: "#E6EAF0",
  pageBg: "#F4F7FB",
  card: "rounded-2xl border border-[#E6EAF0] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]",
  cardPad: "rounded-2xl border border-[#E6EAF0] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)]",
  title: "text-[28px] font-bold tracking-tight text-[#0B1B32]",
  subtitle: "mt-1 text-sm leading-6 text-[#667085]",
  label: "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]",
  input:
    "h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-3.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98A2B3] focus:border-[#16A34A] focus:ring-4 focus:ring-[#16A34A]/15",
  btnPrimary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(22,163,74,0.28)] transition hover:bg-[#15803D]",
  btnSecondary:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB]",
  btnGhost:
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#F2F4F7]",
  badgeActive:
    "inline-flex items-center rounded-full bg-[#ECFDF3] px-2.5 py-0.5 text-[11px] font-semibold text-[#027A48] ring-1 ring-[#A6F4C5]",
  badgePaused:
    "inline-flex items-center rounded-full bg-[#F2F4F7] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085] ring-1 ring-[#E4E7EC]",
  badgeDraft:
    "inline-flex items-center rounded-full bg-[#FFFAEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B54708] ring-1 ring-[#FEDF89]",
  kpi:
    "rounded-2xl border border-[#E6EAF0] bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)]",
  section: "space-y-4",
};

export const QR_MOCK_COLORS = [
  "#16A34A",
  "#2563EB",
  "#DC2626",
  "#EA580C",
  "#7C3AED",
  "#0F172A",
] as const;

export function QrStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "active"
      ? qrUi.badgeActive
      : s === "paused"
        ? qrUi.badgePaused
        : qrUi.badgeDraft;
  return <span className={cls}>{status}</span>;
}

export function QrKpiCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
}) {
  return (
    <div className={qrUi.kpi}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-3xl font-bold tracking-tight text-[#0B1B32]">{value}</p>
        {trend ? (
          <span className="mb-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-semibold text-[#027A48]">
            {trend}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-[#667085]">{hint}</p> : null}
    </div>
  );
}

export function QrEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn(qrUi.cardPad, "flex flex-col items-center py-14 text-center")}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#ECFDF3] text-[#16A34A]">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zm4 4h3v3h-3zm-4 4h7" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[#0B1B32]">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[#667085]">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function QrUpgradeBanner({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#A6F4C5] bg-[linear-gradient(135deg,#ECFDF3_0%,#ffffff_55%)] p-5 shadow-[0_8px_24px_rgba(22,163,74,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#027A48]">Upgrade</p>
      <h3 className="mt-1 text-lg font-bold text-[#0B1B32]">{title}</h3>
      <p className="mt-1 max-w-2xl text-sm text-[#486581]">{body}</p>
      <a href={href} className={cn(qrUi.btnPrimary, "mt-4")}>
        View plans
      </a>
    </div>
  );
}
