"use client";

import React, { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md";

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--accent)", color: "#fff", boxShadow: "0 1px 2px rgba(16,24,40,.12)" },
  secondary: { background: "var(--bg-muted)", color: "var(--text-primary)" },
  ghost: { background: "transparent", color: "var(--text-secondary)" },
  danger: { background: "var(--danger)", color: "#fff" },
  outline: { background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" },
};

export function Button({
  variant = "primary",
  size = "md",
  style,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: size === "sm" ? 30 : 36,
        padding: size === "sm" ? "0 12px" : "0 16px",
        fontSize: size === "sm" ? 12.5 : 13.5,
        fontWeight: 600,
        fontFamily: "inherit",
        borderRadius: 8,
        border: "none",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.55 : 1,
        transition: "background 120ms ease, box-shadow 120ms ease",
        whiteSpace: "nowrap",
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ---------- Inputs ---------- */
const fieldStyle: React.CSSProperties = {
  height: 38,
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  padding: "0 12px",
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "var(--text-primary)",
  outline: "none",
  boxShadow: "0 1px 2px rgba(16,24,40,.04)",
};

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        ...fieldStyle,
        appearance: "none",
        paddingRight: 32,
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        ...props.style,
      }}
    >
      {children}
    </select>
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        marginBottom: 6,
        fontSize: 12.5,
        fontWeight: 600,
        color: "var(--text-primary)",
      }}
    >
      {children}
    </label>
  );
}

/* ---------- Card ---------- */
export function Card({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={cn("surface", className)} style={{ padding: 20, ...style }}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display" style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>
      {children}
    </h3>
  );
}

/* ---------- Status chip ---------- */
const chipTones: Record<string, { bg: string; fg: string }> = {
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  neutral: { bg: "var(--bg-muted)", fg: "var(--text-secondary)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
};

export function StatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: keyof typeof chipTones;
}) {
  const t = chipTones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        borderRadius: 999,
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 600,
        padding: "3px 9px",
        lineHeight: 1.3,
      }}
    >
      {label}
    </span>
  );
}

/* ---------- Avatar ---------- */
const AVATAR_COLORS = ["#3b45e0", "#0e9f8a", "#92600a", "#7c3aed", "#c2410c", "#0369a1"];
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const color = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.38,
        fontWeight: 650,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}
