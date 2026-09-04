import {
  Building2,
  CalendarDays,
  CalendarClock,
  Globe,
  Bell,
  Send,
  PartyPopper,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { SetupStep } from "../mock-data";

const iconMap: Record<string, React.ReactNode> = {
  building: <Building2 size={20} />,
  calendar: <CalendarDays size={20} />,
  "calendar-clock": <CalendarClock size={20} />,
  globe: <Globe size={20} />,
  bell: <Bell size={20} />,
  send: <Send size={20} />,
  party: <PartyPopper size={20} />,
};

export default function StepRow({ step }: { step: SetupStep }) {
  const done = step.status === "done";
  const upNext = step.status === "up-next";

  return (
    <div className="setup-step-row">
      {/* status indicator */}
      <div style={{ width: 26, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        {done ? (
          <CheckCircle2 size={22} color="#22c07a" fill="#e6f9f0" />
        ) : upNext ? (
          <Clock size={22} color="#5b4bd6" />
        ) : (
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1.5px solid #d9d9e6",
              color: "#9a9ab0",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {step.id}
          </span>
        )}
      </div>

      {/* icon tile */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: done ? "#e6f9f0" : upNext ? "#f1efff" : "#f4f4f9",
          color: done ? "#16a36a" : upNext ? "#5b4bd6" : "#9a9ab0",
        }}
      >
        {iconMap[step.icon]}
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#9a9ab0" }}>
            STEP {step.id}
          </span>
          {done && <span className="badge badge-done">Done</span>}
          {upNext && <span className="badge badge-upnext">Up next</span>}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1c2e" }}>{step.title}</div>
        <div style={{ fontSize: 12.5, color: "#8a8aa3" }}>{step.description}</div>
      </div>

      {/* action */}
      {done ? (
        <button className="btn-ghost">
          Review <ExternalLink size={13} />
        </button>
      ) : upNext ? (
        <button className="btn-primary">
          Start <ArrowRight size={14} />
        </button>
      ) : (
        <button className="btn-soft">
          Start <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
