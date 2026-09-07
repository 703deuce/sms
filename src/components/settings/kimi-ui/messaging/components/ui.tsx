"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: { background: "#4f46e5", color: "#fff", border: "1px solid #4f46e5" },
  secondary: { background: "#f1f5f9", color: "#0f172a", border: "1px solid #f1f5f9" },
  ghost: { background: "transparent", color: "#64748b", border: "1px solid transparent" },
  danger: { background: "#e11d48", color: "#fff", border: "1px solid #e11d48" },
  outline: { background: "#fff", color: "#0f172a", border: "1px solid #dbe1ea" },
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ variant = "primary", style, ...props }, ref) => (
  <button
    ref={ref}
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 34,
      padding: "0 14px",
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: "inherit",
      cursor: props.disabled ? "not-allowed" : "pointer",
      opacity: props.disabled ? 0.55 : 1,
      transition: "background 0.12s, border-color 0.12s",
      whiteSpace: "nowrap",
      ...variantStyles[variant],
      ...style,
    }}
    {...props}
  />
));
Button.displayName = "Button";
