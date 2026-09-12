"use client";

import { MCTB_WIZARD_PRIMARY_STEPS, MCTB_WIZARD_PRIMARY_LABELS } from "@/lib/mctb/onboarding/wizard-flow";
import { Check } from "lucide-react";

type Props = {
  currentIndex: number;
  className?: string;
};

export function MctbOnboardingProgress({ currentIndex, className = "" }: Props) {
  return (
    <nav className={`mctb-onb-progress ${className}`.trim()} aria-label="Onboarding progress">
      <ol className="mctb-onb-progress__list">
        {MCTB_WIZARD_PRIMARY_STEPS.map((id, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={id} className="mctb-onb-progress__item">
              <div
                className={`mctb-onb-progress__node${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                aria-current={active ? "step" : undefined}
              >
                <span className="mctb-onb-progress__circle" aria-hidden>
                  {done && !active ? <Check size={14} strokeWidth={3} /> : index + 1}
                </span>
                <span className="mctb-onb-progress__label">{MCTB_WIZARD_PRIMARY_LABELS[id]}</span>
              </div>
              {index < MCTB_WIZARD_PRIMARY_STEPS.length - 1 ? (
                <span className="mctb-onb-progress__rail" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="mctb-onb-progress__mobile" aria-live="polite">
        <span className="mctb-onb-progress__mobile-step">
          Step {currentIndex + 1} of {MCTB_WIZARD_PRIMARY_STEPS.length}
        </span>
        <span className="mctb-onb-progress__mobile-label">
          {MCTB_WIZARD_PRIMARY_LABELS[MCTB_WIZARD_PRIMARY_STEPS[currentIndex]]}
        </span>
        <div className="mctb-onb-progress__bar">
          <div
            className="mctb-onb-progress__bar-fill"
            style={{ width: `${((currentIndex + 1) / MCTB_WIZARD_PRIMARY_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </nav>
  );
}
