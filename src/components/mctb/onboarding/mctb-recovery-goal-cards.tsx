"use client";

import {
  MCTB_RECOVERY_GOALS,
  type MctbRecoveryGoalId,
} from "@/lib/mctb/recovery-goals";

type Props = {
  value: MctbRecoveryGoalId;
  onChange: (id: MctbRecoveryGoalId) => void;
};

export function MctbRecoveryGoalCards({ value, onChange }: Props) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Recovery goal">
      {MCTB_RECOVERY_GOALS.map((goal) => {
        const selected = value === goal.id;
        return (
          <button
            key={goal.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`w-full rounded-lg border p-3 text-left transition ${
              selected
                ? "border-[#2d6cdf] bg-[#f4f8ff]"
                : "border-[#e8eaed] bg-white hover:border-[#d0d4d9]"
            }`}
            onClick={() => onChange(goal.id)}
          >
            <p className="text-[13px] font-semibold text-[#1a1d21]">{goal.title}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#626872]">{goal.description}</p>
          </button>
        );
      })}
    </div>
  );
}
