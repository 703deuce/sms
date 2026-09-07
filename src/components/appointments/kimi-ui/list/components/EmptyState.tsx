import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="tv-empty">
      {icon ? <div className="tv-empty__icon">{icon}</div> : null}
      <h3 className="tv-empty__title">{title}</h3>
      <p className="tv-empty__desc">{description}</p>
      {(actionLabel || secondaryLabel) && (
        <div className="tv-empty__actions">
          {actionLabel && (
            <button type="button" className="tv-btn tv-btn--primary tv-btn--sm" onClick={onAction}>
              {actionLabel}
            </button>
          )}
          {secondaryLabel && (
            <button type="button" className="tv-btn tv-btn--ghost tv-btn--sm" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
