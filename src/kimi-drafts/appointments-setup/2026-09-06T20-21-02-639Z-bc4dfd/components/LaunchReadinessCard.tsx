import type { SetupReadinessItem, SetupStep } from "../mock-data";
import { Check, Minus, CircleDashed, ChevronRight } from "lucide-react";

type Props = {
  readinessItems: SetupReadinessItem[];
  steps: SetupStep[];
  onNavigate: (href: string) => void;
};

export default function LaunchReadinessCard({ readinessItems, steps, onNavigate }: Props) {
  const done = readinessItems.filter((r) => r.state === "done").length;
  return (
    <section className="setup-card" aria-label="Launch readiness">
      <div className="setup-card-header" style={{ paddingBottom: 6 }}>
        <div>
          <h2 className="setup-card-title">Launch readiness</h2>
          <p className="setup-card-subtitle">
            {done} of {readinessItems.length} ready
          </p>
        </div>
      </div>
      <div style={{ padding: "8px 20px 18px" }}>
        {readinessItems.map((item, idx) => {
          const step = steps[idx];
          const actionable = item.state !== "done" && step;
          const content = (
            <>
              {item.state === "done" ? (
                <span className="setup-readiness-dot" style={{ background: "var(--setup-success-soft)", color: "var(--setup-success)" }}>
                  <Check size={11} strokeWidth={3.2} />
                </span>
              ) : item.state === "partial" ? (
                <span className="setup-readiness-dot" style={{ background: "var(--setup-warning-soft)", color: "var(--setup-warning)" }}>
                  <Minus size={11} strokeWidth={3.2} />
                </span>
              ) : (
                <span className="setup-readiness-dot" style={{ background: "#f1f1f6", color: "#b6b6c8" }}>
                  <CircleDashed size={11} strokeWidth={2.6} />
                </span>
              )}
              <span style={{ flex: 1, color: item.state === "pending" ? "var(--setup-muted)" : "var(--setup-text)" }}>
                {item.label}
              </span>
              {item.state === "partial" && (
                <span style={{ fontSize: 11.5, color: "var(--setup-warning)", fontWeight: 600 }}>In progress</span>
              )}
              {actionable && <ChevronRight size={13} style={{ color: "#c3c3d4", flexShrink: 0 }} />}
            </>
          );

          if (actionable) {
            return (
              <button
                key={item.label}
                type="button"
                className="setup-readiness-row setup-readiness-link"
                onClick={() => onNavigate(step.href)}
                aria-label={`${item.label} — ${item.state === "partial" ? "in progress" : "not ready"}. Open ${step.title}.`}
              >
                {content}
              </button>
            );
          }
          return (
            <div key={item.label} className="setup-readiness-row">
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
