"use client";

import React from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "secondary" | "ghost";
  size?: "sm" | "md";
};

export function Button({ variant = "outline", size = "sm", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn("btn", `btn-${variant}`, size === "md" && "px-4 py-2 text-sm", className)}
      {...props}
    />
  );
}

export function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  let bg = "#f1f5f9", color = "#475569", dot = "#94a3b8";
  if (["active", "confirmed", "completed", "delivered", "synced", "sent"].includes(s)) {
    bg = "#ecfdf5"; color = "#047857"; dot = "#10b981";
  } else if (["awaiting_confirmation", "pending", "scheduled", "draft"].includes(s)) {
    bg = "#fffbeb"; color = "#92400e"; dot = "#f59e0b";
  } else if (["no_show", "failed", "sync failed"].includes(s)) {
    bg = "#fef2f2"; color = "#b91c1c"; dot = "#ef4444";
  } else if (["unsubscribed", "blocked", "invalid", "canceled", "cancelled"].includes(s)) {
    bg = "#f1f5f9"; color = "#64748b"; dot = "#94a3b8";
  }
  const label = status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="chip" style={{ background: bg, color }}>
      <span className="dot" style={{ background: dot }} />
      {label}
    </span>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cn("card", className)} style={style}>
      {children}
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        borderBottom: "1px solid var(--border)",
        paddingBottom: 14,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2 className="section-title">
          {icon ? <span className="section-icon">{icon}</span> : null}
          {title}
        </h2>
        {description ? (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}

export function InlineEmpty({ children }: { children: React.ReactNode }) {
  return <div className="empty-inline">{children}</div>;
}

export function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return phone;
}

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAppointmentWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
