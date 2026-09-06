import type { SetupProgressSummary } from "../mock-data";
import { CheckCircle2, Clock } from "lucide-react";

type Props = {
  progress: SetupProgressSummary;
  onboardingComplete: boolean;
};

export default function SetupProgressCard({ progress, onboardingComplete }: Props) {
  const { completed, total, percent, estTime } = progress;
  return (
    <section className="setup-card" aria-label="Setup progress">
      <div className="setup-card-header" style={{ paddingBottom: 0 }}>
        <div>
          <h2 className="setup-card-title">Setup progress</h2>
          <p className="setup-card-subtitle">
            {completed === total
              ? "Everything is configured and ready to go."
              : `${completed} of ${total} steps complete`}
          </p>
        </div>
        {onboardingComplete ? (
          <span className="setup-chip setup-chip-success">
            <CheckCircle2 size={12} strokeWidth={2.4} />
            Complete
          </span>
        ) : (
          <span className="setup-chip setup-chip-neutral">
            <Clock size={12} strokeWidth={2.4} />
            {estTime} left
          </span>
        )}
      </div>
      <div style={{ padding: "16px 20px 20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--setup-text)" }}>
            {percent}%
          </span>
          <span style={{ fontSize: 12.5, color: "var(--setup-muted)" }}>
            {completed}/{total} steps
          </span>
        </div>
        <div
          className="setup-progress-track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Setup ${percent}% complete`}
        >
          <div className="setup-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </section>
  );
}
