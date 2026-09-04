import { setupSteps } from "../mock-data";
import StepRow from "./StepRow";

export default function StepList() {
  return (
    <div className="setup-card" style={{ overflow: "hidden" }}>
      {setupSteps.map((s) => (
        <StepRow key={s.id} step={s} />
      ))}
    </div>
  );
}
