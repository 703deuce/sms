import React from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  CalendarClock,
  Globe,
  Bell,
  Send,
  PartyPopper,
  Check,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { SetupStep } from "../types";

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
    <Link href={step.href} className={`step-row ${done ? "step-row--done" : ""}`}>
      <div
        className={`step-row__badge ${
          done ? "step-row__badge--done" : upNext ? "step-row__badge--next" : ""
        }`}
      >
        {done ? <Check size={13} strokeWidth={3} /> : upNext ? <span className="step-row__clock">◔</span> : step.id}
      </div>

      <div
        className={`step-row__icon ${
          done ? "step-row__icon--done" : upNext ? "step-row__icon--next" : ""
        }`}
      >
        {iconMap[step.icon]}
      </div>

      <div className="step-row__content">
        <div className="step-row__meta">
          <span className="step-row__label">{step.label.toUpperCase()}</span>
          {step.statusText ? (
            <span
              className={`step-row__pill ${
                done ? "step-row__pill--done" : "step-row__pill--next"
              }`}
            >
              {step.statusText}
            </span>
          ) : null}
        </div>
        <h3 className="step-row__title">{step.title}</h3>
        <p className="step-row__desc">{step.description}</p>
      </div>

      {step.action === "review" ? (
        <span className="step-row__review">
          Review <ExternalLink size={13} />
        </span>
      ) : (
        <span className={`step-row__start ${upNext ? "step-row__start--primary" : ""}`}>
          Start <ArrowRight size={14} />
        </span>
      )}
    </Link>
  );
}
