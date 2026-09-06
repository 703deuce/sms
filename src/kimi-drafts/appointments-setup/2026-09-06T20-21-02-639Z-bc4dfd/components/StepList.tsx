import type { SetupStep } from "../mock-data";
import {
  Building2,
  Calendar,
  CalendarClock,
  Globe,
  Bell,
  Send,
  PartyPopper,
  Check,
  ArrowRight,
  ChevronRight,
} from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  building: Building2,
  calendar: Calendar,
  "calendar-clock": CalendarClock,
  globe: Globe,
  bell: Bell,
  send: Send,
  party: PartyPopper,
};

function StatusChip({ status }: { status: SetupStep["status"] }) {
  if (status === "done")
    return (
      <span className="setup-chip setup-chip-success">
        <Check size={11} strokeWidth={3} />
        Done
      </span>
    );
  if (status === "up-next")
    return <span className="setup-chip setup-chip-accent">Up next</span>;
  return <span className="setup-chip setup-chip-neutral">Not started</span>;
}

export default function StepList({
  steps,
  onNavigate,
}: {
  steps: SetupStep[];
  onNavigate: (href: string) => void;
}) {
  return (
    <section className="setup-card" aria-label="Setup checklist">
      <div className="setup-card-header" style={{ paddingBottom: 12 }}>
        <div>
          <h2 className="setup-card-title">Setup checklist</h2>
          <p className="setup-card-subtitle">
            Complete each step to start accepting bookings.
          </p>
        </div>
      </div>
      <div role="list">
        {steps.map((step) => {
          const Icon = ICONS[step.icon] ?? Calendar;
          const iconClass =
            step.status === "done"
              ? "setup-step-icon-done"
              : step.status === "up-next"
                ? "setup-step-icon-next"
                : "setup-step-icon-pending";
          return (
            <button
              key={step.id}
              type="button"
              role="listitem"
              className="setup-step-row"
              onClick={() => onNavigate(step.href)}
              aria-label={`${step.title} — ${step.status === "done" ? "done" : step.status === "up-next" ? "up next" : "not started"}. Open ${step.title}.`}
            >
              <span className={`setup-step-icon ${iconClass}`}>
                {step.status === "done" ? (
                  <Check size={17} strokeWidth={2.6} />
                ) : (
                  <Icon size={17} strokeWidth={2} />
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className={`setup-step-title ${step.status === "done" ? "setup-step-done-text" : ""}`}>
                  <span style={{ color: "var(--setup-muted)", fontWeight: 500, fontSize: 12 }}>{step.id}.</span>
                  {step.title}
                </span>
                <span className="setup-step-desc" style={{ display: "block" }}>
                  {step.description}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <StatusChip status={step.status} />
                {step.status === "up-next" ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--setup-accent)",
                    }}
                  >
                    Start
                    <ArrowRight size={13} strokeWidth={2.4} />
                  </span>
                ) : (
                  <ChevronRight size={15} style={{ color: "#c3c3d4" }} />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
