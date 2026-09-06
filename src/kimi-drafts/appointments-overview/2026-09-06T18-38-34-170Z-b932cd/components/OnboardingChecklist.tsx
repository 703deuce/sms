import { Check, ChevronRight, Rocket, X } from "lucide-react";
import type { OnboardingStep } from "../mock-data";

type Props = {
  steps: OnboardingStep[];
  onStepAction: (step: OnboardingStep) => void;
  onDismiss: () => void;
};

export default function OnboardingChecklist({ steps, onStepAction, onDismiss }: Props) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section className="ref-card mb-5 overflow-hidden">
      <div className="flex items-start justify-between px-[18px] pt-4">
        <div className="flex items-center gap-3">
          <span className="ref-tint-purple flex h-9 w-9 items-center justify-center rounded-xl">
            <Rocket size={16} />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-gray-900">Finish setting up appointments</h2>
            <p className="mt-0.5 text-[12.5px] text-gray-500">{done} of {steps.length} complete — you&apos;re almost ready to take bookings.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss setup checklist"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-[18px] pt-3">
        <div className="ref-progress-track">
          <div className="ref-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-2 grid gap-0.5 px-2 pb-3 sm:grid-cols-2">
        {steps.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <span
              className={`ref-step-check ${s.done ? "bg-emerald-100 text-emerald-600" : "border-2 border-gray-200 text-transparent"}`}
              aria-hidden="true"
            >
              <Check size={12} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-[13px] font-medium ${s.done ? "text-gray-400 line-through" : "text-gray-900"}`}>{s.label}</div>
              <div className="truncate text-[11.5px] text-gray-500">{s.sub}</div>
            </div>
            {!s.done && (
              <button
                onClick={() => onStepAction(s)}
                className="flex shrink-0 items-center gap-0.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
              >
                {s.cta} <ChevronRight size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
