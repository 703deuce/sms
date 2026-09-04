import React from "react";
import { CheckCircle2, Footprints } from "lucide-react";
import type { SetupSummary } from "../types";

export default function ProgressHeader({
  summary,
  headline,
}: {
  summary: SetupSummary;
  headline?: string;
}) {
  const size = 68;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = c * (summary.completed / summary.total);
  const defaultHeadline =
    summary.percent === 100
      ? "All steps complete!"
      : summary.completed === 0
        ? "Let's get started!"
        : "Almost there!";

  return (
    <div className="progress-card">
      <div className="progress-ring">
        <svg width={size} height={size} className="progress-ring__svg">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#ede9fe"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#5b3df5"
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="progress-ring__label">
          <span className="progress-ring__num">{summary.completed}</span>
          <span className="progress-ring__of">of {summary.total}</span>
        </div>
      </div>

      <div className="progress-card__body">
        <p className="progress-card__headline">
          <strong>{headline || defaultHeadline}</strong> You&apos;re {summary.percent}% complete.
        </p>
        <div className="progress-bar">
          <div className="progress-bar__fill" style={{ width: `${summary.percent}%` }} />
        </div>
        <div className="progress-card__stats">
          <div className="stat">
            <CheckCircle2 className="stat__icon stat__icon--done" size={18} />
            <span className="stat__num">{summary.completed}</span>
            <span className="stat__label">Completed</span>
          </div>
          <div className="stat__divider" />
          <div className="stat">
            <Footprints className="stat__icon stat__icon--progress" size={18} />
            <span className="stat__num">{summary.inProgress}</span>
            <span className="stat__label">In progress</span>
          </div>
          <div className="stat__divider" />
          <div className="stat">
            <span className="stat__num">{summary.notStarted}</span>
            <span className="stat__label">Not started</span>
          </div>
          <div className="stat stat--time">
            <span className="stat__label">Est. time remaining</span>
            <span className="stat__time">{summary.estTime}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
