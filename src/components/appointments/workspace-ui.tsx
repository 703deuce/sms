"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

export function SectionCard({
  id,
  title,
  description,
  icon: Icon,
  action,
  flush,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon?: IconType;
  action?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="ws-card" aria-labelledby={id}>
      <div className="ws-card-head">
        {Icon ? (
          <span className="ws-card-icon" aria-hidden>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 id={id} className="ws-card-title">
            {title}
          </h2>
          {description ? <p className="ws-card-desc">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={flush ? "ws-card-body-flush" : "ws-card-body"}>{children}</div>
    </section>
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
  onSelect,
}: {
  selected: boolean;
  icon: IconType;
  name: string;
  helper?: string;
  status?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="ws-choice-card" aria-pressed={selected} onClick={onSelect}>
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
