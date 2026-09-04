import React from "react";
import StepRow from "./StepRow";
import type { SetupStep } from "../types";

export default function SetupStepsList({ steps }: { steps: SetupStep[] }) {
  return (
    <div className="steps-list">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  );
}
