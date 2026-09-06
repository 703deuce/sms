"use client";

import React from "react";

/* Button */
export function Button({
  variant = "primary",
  size,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm";
}) {
  return (
    <button
      className={`btn btn-${variant}${size === "sm" ? " btn-sm" : ""} ${className}`}
      {...props}
    />
  );
}

/* Status badge */
const tone: Record<string, { cls: string; label: string }> = {
  confirmed: { cls: "badge-success", label: "Confirmed" },
  awaiting_confirmation: { cls: "badge-warning", label: "Awaiting confirmation" },
  scheduled: { cls: "badge-info", label: "Scheduled" },
  reschedule_requested: { cls: "badge-warning", label: "Reschedule requested" },
  canceled: { cls: "badge-neutral", label: "Canceled" },
  completed: { cls: "badge-violet", label: "Completed" },
  no_show: { cls: "badge-danger", label: "No-show" },
  sent: { cls: "badge-success", label: "Sent" },
  failed: { cls: "badge-danger", label: "Failed" },
  disabled: { cls: "badge-neutral", label: "Disabled" },
  skipped: { cls: "badge-neutral", label: "Skipped" },
  paid: { cls: "badge-success", label: "Paid" },
  refunded: { cls: "badge-neutral", label: "Refunded" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const t = tone[status] || { cls: "badge-neutral", label: status };
  return (
    <span className={`badge ${t.cls}`}>
      <span className="dot" />
      {label || t.label}
    </span>
  );
}

/* Card */
export function Card({
  title,
  sub,
  actions,
  children,
  pad = true,
}: {
  title?: React.ReactNode;
  sub?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  pad?: boolean;
}) {
  return (
    <section className={`card${pad ? " card-pad" : ""}`}>
      {title ? (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <h3 className="card-title">{title}</h3>
            {sub ? <p className="card-sub">{sub}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* Modal */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/* Toggle */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
    />
  );
}

/* Date formatting helpers */
export function fmtDate(iso: string, tz?: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: tz || undefined,
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
export function fmtTime(iso: string, tz?: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: tz || undefined, hour: "numeric", minute: "2-digit",
  });
}
export function fmtDay(iso: string, tz?: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: tz || undefined, weekday: "short", month: "short", day: "numeric",
  });
}
export function fmtDateTime(iso: string, tz?: string) {
  return new Date(iso).toLocaleString(undefined, {
    timeZone: tz || undefined, month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
export function fmtPhone(p: string) {
  const d = p.replace(/\D/g, "").slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
export function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
