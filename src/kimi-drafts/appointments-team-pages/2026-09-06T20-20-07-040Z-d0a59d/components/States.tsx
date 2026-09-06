import React from "react";
import { CalendarPlus, Users2, AlertCircle } from "lucide-react";

export function SkeletonCards({ rows = 2 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="surface" style={{ padding: 18 }}>
          <div className="skeleton" style={{ height: 16, width: "38%", marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 12, width: "62%", marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 34, width: "100%" }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon, title, body, action,
}: {
  icon: "group" | "page";
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const Icon = icon === "group" ? Users2 : CalendarPlus;
  return (
    <div className="surface" style={{
      padding: "40px 24px", display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: "var(--primary-soft)",
        color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 14,
      }}>
        <Icon size={20} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, color: "var(--fg-muted)", maxWidth: 380, margin: "0 0 16px", lineHeight: 1.55 }}>{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="surface" style={{
      padding: "32px 24px", display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center",
    }}>
      <AlertCircle size={22} style={{ color: "var(--danger)", marginBottom: 10 }} />
      <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 6 }}>Team booking pages couldn't be loaded</div>
      <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: "0 0 16px" }}>
        Your existing configuration is unchanged. Try loading the page again.
      </p>
      <button className="btn btn-outline btn-sm" onClick={onRetry}>Retry</button>
    </div>
  );
}

export function PartialNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: 9,
        background: "var(--warning-soft)", border: "1px solid #f5d9bd",
        borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--warning)",
      }}
    >
      <AlertCircle size={15} style={{ flex: "none", marginTop: 1 }} />
      <span>{message}</span>
    </div>
  );
}
