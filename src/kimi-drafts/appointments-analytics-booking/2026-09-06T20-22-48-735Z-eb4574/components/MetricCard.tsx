import type { ReactNode } from "react";

export default function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "tone-accent",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className="card metric-card">
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
        {hint ? <p className="metric-hint">{hint}</p> : null}
      </div>
      <div className={`metric-icon ${tone}`} aria-hidden="true">
        {icon}
      </div>
    </div>
  );
}
