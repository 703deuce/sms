import {
  CSSProperties,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
  forwardRef,
} from "react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Button ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variantStyle: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "#fff",
    boxShadow: "0 1px 2px rgba(16,24,40,0.08)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "var(--surface-subtle)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--danger)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 1px 2px rgba(16,24,40,0.08)",
  },
  outline: {
    background: "var(--surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
  },
};

const sizeStyle: Record<Size, CSSProperties> = {
  sm: { height: 32, padding: "0 12px", fontSize: 13 },
  md: { height: 38, padding: "0 16px", fontSize: 14 },
  lg: { height: 44, padding: "0 20px", fontSize: 14.5 },
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", fullWidth, style, onMouseEnter, onMouseLeave, ...props },
    ref,
  ) => {
    const base: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      whiteSpace: "nowrap",
      borderRadius: "var(--radius-sm)",
      fontWeight: 600,
      cursor: props.disabled ? "not-allowed" : "pointer",
      opacity: props.disabled ? 0.55 : 1,
      transition: "background 120ms ease, box-shadow 120ms ease, transform 80ms ease",
      width: fullWidth ? "100%" : undefined,
      ...variantStyle[variant],
      ...sizeStyle[size],
      ...style,
    };

    return (
      <button
        ref={ref}
        style={base}
        onMouseEnter={(e) => {
          if (!props.disabled && variant === "primary") {
            e.currentTarget.style.background = "var(--accent-hover)";
          }
          if (!props.disabled && (variant === "secondary" || variant === "ghost" || variant === "outline")) {
            e.currentTarget.style.background = "#eef0f3";
          }
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background =
            (variantStyle[variant].background as string) || "transparent";
          onMouseLeave?.(e);
        }}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

/* ---------- Card ---------- */

export function Card({
  style,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        padding: 24,
        ...style,
      }}
      {...props}
    />
  );
}

/* ---------- Spinner ---------- */

export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="pub-spin"
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid rgba(79,70,229,0.25)",
        borderTopColor: "var(--accent)",
      }}
    />
  );
}

/* ---------- Status Badge ---------- */

const statusTones: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  confirmed: { bg: "#ecfdf5", fg: "#047857", dot: "#10b981", label: "Confirmed" },
  awaiting_confirmation: { bg: "#fffbeb", fg: "#92400e", dot: "#f59e0b", label: "Awaiting confirmation" },
  scheduled: { bg: "#eff6ff", fg: "#1d4ed8", dot: "#3b82f6", label: "Scheduled" },
  reschedule_requested: { bg: "#fff7ed", fg: "#9a3412", dot: "#f97316", label: "Reschedule requested" },
  canceled: { bg: "#f1f5f9", fg: "#475569", dot: "#94a3b8", label: "Canceled" },
  cancelled: { bg: "#f1f5f9", fg: "#475569", dot: "#94a3b8", label: "Canceled" },
  completed: { bg: "#dcefeb", fg: "#10665f", dot: "#147d74", label: "Completed" },
  no_show: { bg: "#fff1f2", fg: "#be123c", dot: "#f43f5e", label: "No-show" },
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  const tone = statusTones[status.toLowerCase()] ?? {
    bg: "#f1f5f9",
    fg: "#475569",
    dot: "#94a3b8",
    label: status.replace(/_/g, " "),
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: 1,
        background: tone.bg,
        color: tone.fg,
        boxShadow: `inset 0 0 0 1px ${tone.dot}26`,
      }}
    >
      <span
        style={{ width: 6, height: 6, borderRadius: "50%", background: tone.dot }}
        aria-hidden="true"
      />
      {tone.label}
    </span>
  );
}

/* ---------- Date/time formatters ---------- */

export function formatWhen(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleString(undefined, {
    timeZone: timezone || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTime(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone: timezone || undefined,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDayLong(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: timezone || undefined,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatDayShort(iso: string, timezone?: string | null) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: timezone || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function timezoneAbbrev(timezone?: string | null) {
  if (!timezone) return "";
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
}

export function IconTile({
  children,
  tone = "accent",
  size = 40,
}: {
  children: ReactNode;
  tone?: "accent" | "success" | "danger";
  size?: number;
}) {
  const tones = {
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
    success: { bg: "var(--success-soft)", fg: "var(--success)" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  }[tone];
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 12,
        background: tones.bg,
        color: tones.fg,
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
