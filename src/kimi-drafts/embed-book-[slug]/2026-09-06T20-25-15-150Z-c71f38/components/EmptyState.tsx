"use client";

import { AlertCircle, CalendarX, Phone } from "lucide-react";

export default function EmptyState({
  tone = "neutral",
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  secondaryHref,
}: {
  tone?: "neutral" | "error";
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  const isError = tone === "error";
  return (
    <div className="eb-done">
      <div
        className="eb-done__icon"
        style={
          isError
            ? { background: "#fef2f1", color: "var(--danger)" }
            : { background: "#eef0f4", color: "var(--text-2)" }
        }
      >
        {isError ? <AlertCircle size={26} aria-hidden /> : <CalendarX size={26} aria-hidden />}
      </div>
      <h1 className="eb-done__title">{title}</h1>
      <p className="eb-done__sub" role={isError ? "alert" : undefined}>{body}</p>
      <div className="eb-done__cta">
        {actionLabel && onAction ? (
          <button type="button" className="eb-btn eb-btn--primary" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        {secondaryLabel && secondaryHref ? (
          <a className="eb-btn eb-btn--outline" href={secondaryHref} style={{ textDecoration: "none" }}>
            <Phone size={14} aria-hidden /> {secondaryLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
