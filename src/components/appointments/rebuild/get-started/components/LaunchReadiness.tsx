import React from "react";
import { Check, Rocket } from "lucide-react";
import type { SetupStep } from "../types";

export default function LaunchReadiness({
  percent,
  steps,
}: {
  percent: number;
  steps: SetupStep[];
}) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const c = Math.PI * r;
  const filled = c * (percent / 100);

  return (
    <div className="card">
      <h3 className="card__title">Launch readiness</h3>
      <div className="gauge">
        <svg width="200" height="110" viewBox="0 0 200 110">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#ede9fe"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#5b3df5"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
          />
        </svg>
        <div className="gauge__rocket">
          <span className="gauge__sparkle gauge__sparkle--1">✦</span>
          <span className="gauge__sparkle gauge__sparkle--2">✦</span>
          <Rocket size={34} className="gauge__icon" />
          <span className="gauge__confetti">🎉</span>
        </div>
      </div>

      <h4 className="launch__headline">
        {percent === 100 ? "Ready to launch!" : "You&apos;re almost ready to launch!"}
      </h4>
      <p className="launch__sub">
        Complete the remaining steps to start accepting bookings.
      </p>

      <ul className="launch__list">
        {steps.map((s) => (
          <li
            key={s.id}
            className={`launch__item ${s.status === "done" ? "launch__item--done" : ""}`}
          >
            <span className="launch__dot">
              {s.status === "done" && <Check size={11} strokeWidth={3} />}
            </span>
            {s.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
