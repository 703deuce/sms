"use client";
import React, { ButtonHTMLAttributes, InputHTMLAttributes, forwardRef } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-[var(--primary)] text-white shadow-sm hover:bg-[var(--primary-hover)]",
  secondary: "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[#e2e5ea]",
  ghost: "bg-transparent text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
  danger: "bg-[var(--danger)] text-white shadow-sm hover:opacity-90",
  outline: "border border-[var(--border)] bg-white text-[var(--foreground)] shadow-sm hover:bg-[#f5f6f8]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  icon: "h-8 w-8",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button ref={ref} className={cn(
      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
      variants[variant], sizes[size], className)} {...props} />
  ));
Button.displayName = "Button";

/* ---------- Card ---------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface rounded-xl bg-white p-5", className)} {...props} />;
}

/* ---------- Inputs ---------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(
      "flex h-10 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[var(--primary)] focus:ring-2 focus:ring-[#2547e033] disabled:bg-[#f2f4f7]",
      className)} {...props} />
  ));
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-[13px] font-semibold tracking-tight text-[#344054]", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(
    "flex min-h-24 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2.5 text-sm leading-relaxed shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-[#98a2b3] focus:border-[var(--primary)] focus:ring-2 focus:ring-[#2547e033]",
    className)} {...props} />;
}

const chevron = "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]";
export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(
      "flex h-10 w-full appearance-none rounded-[10px] border border-[var(--border)] bg-white bg-no-repeat pl-3 pr-9 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-2 focus:ring-[#2547e033]",
      chevron, "bg-[position:right_0.75rem_center]", className)} {...props}>
      {children}
    </select>
  );
}

/* ---------- Switch ---------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label || "toggle"} onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1",
        checked ? "bg-[var(--primary)]" : "bg-[#d0d5dd]")}>
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-150", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/* ---------- Status chip ---------- */
export type StatusTone = "success" | "warning" | "neutral" | "danger" | "info";
const tones: Record<StatusTone, string> = {
  success: "bg-[var(--success-bg)] text-[var(--success)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  neutral: "bg-[#f2f4f7] text-[#475467]",
  danger: "bg-[#fef3f2] text-[var(--danger)]",
  info: "bg-[var(--info-bg)] text-[var(--info)]",
};
export function StatusChip({ tone = "neutral", children, dot }: { tone?: StatusTone; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Channel badge ---------- */
export function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = { sms: "bg-[#eff4ff] text-[#2547e0]", email: "bg-[#f0fdf9] text-[#067647]", voice: "bg-[#f4f3ff] text-[#5925dc]" };
  return <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", map[channel] || "bg-[#f2f4f7] text-[#475467]")}>{channel}</span>;
}

/* ---------- Modal shell ---------- */
export function Modal({ open, onClose, title, subtitle, children, footer, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fade-in absolute inset-0 bg-[#10182866]" onClick={onClose} />
      <div className={cn("modal-in relative w-full overflow-hidden rounded-2xl bg-white shadow-xl", width)} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-[var(--muted-foreground)]">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="scrollbar-thin max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[#fafbfc] px-6 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
export function Toast({ message, tone = "success" }: { message: string; tone?: StatusTone }) {
  return (
    <div className={cn("toast-in fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-lg", tones[tone], "border border-[var(--border)] bg-white")}>
      {message}
    </div>
  );
}
