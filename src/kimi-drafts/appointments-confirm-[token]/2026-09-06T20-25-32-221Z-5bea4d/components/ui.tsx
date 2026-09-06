import type { ButtonHTMLAttributes, ReactElement } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
}): ReactElement {
  return (
    <button
      className={`btn btn-${variant}${className ? ` ${className}` : ""}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="btn-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): ReactElement {
  return <div className={`pub-card${className ? ` ${className}` : ""}`}>{children}</div>;
}
