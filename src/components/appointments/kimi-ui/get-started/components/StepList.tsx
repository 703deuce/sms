import type { SetupStep } from "@/features/appointments/kimi/setup/types";
import StepRow from "./StepRow";

type Props = {
  steps: SetupStep[];
  onNavigate: (href: string) => void;
};

export default function StepList({ steps, onNavigate }: Props) {
  return (
    <div className="setup-card" style={{ overflow: "hidden" }}>
      {steps.map((s) => (
        <StepRow key={s.id} step={s} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
