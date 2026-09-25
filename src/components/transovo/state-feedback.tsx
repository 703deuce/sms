import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function TransovoPageLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="transovo-state-panel" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function TransovoPageEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="transovo-state-panel px-6" role="status">
      <p className="font-medium text-[var(--transovo-text)]">{title}</p>
      {description ? <p className="mt-1 text-[var(--transovo-text-muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function TransovoSectionError({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive",
        className,
      )}
      role="alert"
    >
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-2 font-medium underline underline-offset-2"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function TransovoInlineErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  if (!message) return null;
  return (
    <div className="transovo-inline-error-banner" role="alert">
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error">
        ×
      </button>
    </div>
  );
}
