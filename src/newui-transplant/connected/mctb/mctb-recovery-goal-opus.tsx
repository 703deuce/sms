"use client";

import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/newui-transplant/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { MctbAiRecoveryGoalType } from "@/lib/mctb/lead-recovery/types";

const OPTIONS: Array<{
  value: MctbAiRecoveryGoalType;
  title: string;
  description: string;
}> = [
  {
    value: "FOLLOW_UP",
    title: "Collect information for follow-up",
    description:
      "Understand what they need, collect the details below, and let them know your team will follow up.",
  },
  {
    value: "SCHEDULE",
    title: "Get them to schedule",
    description:
      "Answer basic questions, collect the information you need, and guide them to your booking link when they're ready.",
  },
  {
    value: "CUSTOM",
    title: "Custom goal",
    description: "Tell AI what outcome you want from the conversation.",
  },
];

export type MctbRecoveryGoalOpusProps = {
  value: MctbAiRecoveryGoalType;
  onChange: (value: MctbAiRecoveryGoalType) => void;
  customGoal: string;
  onCustomGoalChange: (value: string) => void;
  className?: string;
};

export function MctbRecoveryGoalOpus({
  value,
  onChange,
  customGoal,
  onCustomGoalChange,
  className,
}: MctbRecoveryGoalOpusProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as MctbAiRecoveryGoalType)}
        className="flex flex-col gap-2"
      >
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
              value === opt.value
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:bg-muted/40",
            )}
          >
            <RadioGroupItem value={opt.value} className="mt-0.5 shrink-0" aria-label={opt.title} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium leading-snug">{opt.title}</span>
              <span className="text-sm text-muted-foreground">{opt.description}</span>
            </span>
          </label>
        ))}
      </RadioGroup>

      {value === "CUSTOM" ? (
        <div className="grid gap-1.5 pt-1">
          <Label htmlFor="lr-custom-recovery-goal">What should AI accomplish?</Label>
          <Textarea
            id="lr-custom-recovery-goal"
            rows={4}
            className="min-h-[6rem] resize-y"
            placeholder="Find out what type of project they need help with, collect their contact details, and let them know we'll call to schedule a free estimate."
            value={customGoal}
            onChange={(e) => onCustomGoalChange(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
