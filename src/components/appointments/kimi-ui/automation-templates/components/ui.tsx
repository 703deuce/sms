import { ReactNode } from "react";

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: "success" | "info" | "muted" | "warning" | "accent";
  children: ReactNode;
}) {
  return <span className={`tv-badge tv-badge-${tone}`}>{children}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="tv-chip">{children}</span>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="tv-card tv-empty">
      <div className="tv-empty-icon">{icon}</div>
      <p className="tv-empty-title">{title}</p>
      <p className="tv-empty-desc">{description}</p>
      {action}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="tv-template-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tv-skeleton" />
      ))}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="tv-error" role="alert">
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button className="tv-btn tv-btn-sm tv-btn-outline" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function NoticeBanner({
  tone = "info",
  children,
  action,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="tv-error"
      role="status"
      style={
        tone === "warning"
          ? {
              background: "var(--tv-warning-soft)",
              borderColor: "#fedf89",
              color: "var(--tv-warning)",
            }
          : {
              background: "var(--tv-info-soft)",
              borderColor: "#b2ddff",
              color: "var(--tv-info)",
            }
      }
    >
      <span style={{ flex: 1 }}>{children}</span>
      {action}
    </div>
  );
}
