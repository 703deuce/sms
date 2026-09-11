"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

/**
 * A section of a workspace: heading, one line of context, then its controls,
 * closed by a rule. Deliberately not a card — the workspace already sits in a
 * panel, and wrapping each group in its own bordered surface stacks borders
 * inside borders and pushes everything into a tall column of boxes.
 */
export function SectionCard({
  id,
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon?: IconType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="ws-flat-section" aria-labelledby={id}>
      <div className="ws-flat-head">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="ws-flat-title">
            {Icon ? <Icon className="ws-flat-title-icon h-4 w-4" aria-hidden /> : null}
            {title}
          </h2>
          {description ? <p className="ws-flat-desc">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="ws-flat-body">{children}</div>
    </section>
  );
}

/**
 * A bordered cell for the wide grid. `SectionCard` is a full-width band
 * separated by rules and cannot sit beside another one; this can, which is
 * what lets Capacity put three summaries across the top of the section.
 */
export function Panel({
  title,
  icon: Icon,
  actions,
  flush,
  className,
  children,
}: {
  title: string;
  icon?: IconType;
  actions?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={`ws-panel${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      <div className="ws-panel-head">
        <h3 className="ws-panel-title" id={titleId}>
          {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
          {title}
        </h3>
        {actions ? <div className="ws-panel-actions">{actions}</div> : null}
      </div>
      <div className={`ws-panel-body${flush ? " is-flush" : ""}`}>{children}</div>
    </section>
  );
}

/**
 * Right-hand overlay for record detail. Portalled for the same reason the
 * modal is: the workspace sits in a z-index:1 stacking context and anything
 * rendered in place is painted under the product sidebar.
 */
export function Drawer({
  title,
  description,
  onClose,
  footer,
  wide,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  /** For a drawer holding a table rather than a field list. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="ws-pilot appt-overview-pilot ref-root ws-portal">
      <div
        className="ws-drawer-scrim"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className={wide ? "ws-drawer is-wide" : "ws-drawer"}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={ref}
        >
          <div className="ws-drawer-head">
            <div className="min-w-0 flex-1">
              <h2 className="ws-drawer-title" id={titleId}>
                {title}
              </h2>
              {description ? <p className="ws-card-desc">{description}</p> : null}
            </div>
            <button type="button" className="ws-icon-btn" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="ws-drawer-body">{children}</div>
          {footer ? <div className="ws-drawer-foot">{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-[var(--type-label)] font-medium text-[var(--text-primary)]"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      {error ? <p className="ws-inline-error">{error}</p> : hint ? <p className="ws-field-hint">{hint}</p> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`input ${className}`.trim()} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select {...rest} className={`input ${className}`.trim()} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`input ${className}`.trim()} />;
}

export function NumberField({
  suffix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { suffix: string }) {
  const { className = "", ...rest } = props;
  return (
    <span className="ws-suffix-field">
      <input {...rest} type="number" className={`input ${className}`.trim()} />
      <span>{suffix}</span>
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="ws-switch-row">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[var(--type-list)] font-medium text-[var(--text-primary)]">
          {label}
        </label>
        {description ? <p className="ws-field-hint">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className="ws-switch"
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function ChoiceCard({
  selected,
  icon: Icon,
  name,
  helper,
  status,
  disabled,
  disabledReason,
  onSelect,
}: {
  selected: boolean;
  icon: IconType;
  name: string;
  helper?: string;
  status?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="ws-choice-card"
      aria-pressed={selected}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={onSelect}
    >
      <span className="ws-choice-icon" aria-hidden>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="ws-choice-name block">{name}</span>
        {helper ? <span className="ws-choice-help block">{helper}</span> : null}
        {status ? <span className="mt-1.5 block">{status}</span> : null}
      </span>
    </button>
  );
}

/**
 * Collapsible module used by Booking rules and Advanced. Configuration expands
 * in place under its own summary row so a setting is never shown twice.
 */
export function Module({
  open,
  onToggle,
  icon: Icon,
  title,
  value,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: IconType;
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  const bodyId = useId();
  return (
    <div className={`ws-module${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ws-module-trigger"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span className="ws-module-icon" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="ws-module-title block">{title}</span>
          <span className="ws-module-value block">{value}</span>
        </span>
        <ChevronDown className="ws-module-chevron h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div className="ws-module-body" id={bodyId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Modal({
  title,
  description,
  onClose,
  footer,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Only ever rendered in response to a user action, so the document exists.
  if (typeof document === "undefined") return null;

  /*
   * The workspace sits inside a z-index:1 stacking context, so an overlay
   * rendered in place is painted under the app sidebar. Portalling to the body
   * escapes that context; the scope class is reapplied so the workspace styles
   * still reach the dialog.
   */
  return createPortal(
    <div className="ws-pilot appt-overview-pilot ref-root ws-portal">
      <div
        className="ws-overlay"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="ws-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
          <div className="ws-modal-head">
            <div className="min-w-0">
              <h2 className="ws-modal-title" id={titleId}>
                {title}
              </h2>
              {description ? <p className="ws-card-desc">{description}</p> : null}
            </div>
            <button type="button" className="ws-icon-btn" aria-label="Close" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="ws-modal-body">{children}</div>
          <div className="ws-modal-foot">{footer}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
