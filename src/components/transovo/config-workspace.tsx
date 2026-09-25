import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Open-surface section — typography + hairline, not a card. */
export function ConfigSection({
  id,
  title,
  description,
  children,
  className,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("transovo-config-section scroll-mt-24", className)}>
      <div className="transovo-config-section__head">
        <h2 className="transovo-config-section__title">{title}</h2>
        {description ? <p className="transovo-config-section__desc">{description}</p> : null}
      </div>
      <div className="transovo-config-section__body">{children}</div>
    </section>
  );
}

/** Uppercase group label + horizontal rule (setup overview, config pages). */
export function ConfigGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="transovo-config-group">
      <span className="transovo-config-group__label">{children}</span>
      <span className="transovo-config-group__rule" aria-hidden />
    </div>
  );
}

/** Single settings row: label | value/detail | action */
export function ConfigRow({
  label,
  detail,
  value,
  href,
  actionLabel = "Manage",
  onAction,
}: {
  label: string;
  detail?: string;
  value?: ReactNode;
  href?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const action =
    href ? (
      <a href={href} className="transovo-config-row__action">
        {actionLabel}
      </a>
    ) : onAction ? (
      <button type="button" onClick={onAction} className="transovo-config-row__action">
        {actionLabel}
      </button>
    ) : null;

  return (
    <div className="transovo-config-row">
      <div className="transovo-config-row__main">
        <span className="transovo-config-row__label">{label}</span>
        {detail ? <span className="transovo-config-row__detail">{detail}</span> : null}
      </div>
      {value != null ? <span className="transovo-config-row__value">{value}</span> : null}
      {action}
    </div>
  );
}
