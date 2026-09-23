"use client";

import { MctbRecoveryGoalCards } from "@/components/mctb/onboarding/mctb-recovery-goal-cards";
import {
  getRecoveryGoalDefinition,
  type MctbRecoveryGoalId,
} from "@/lib/mctb/recovery-goals";
import { MCTB_LAUNCH_GOAL_DRIVEN_RECOVERY_UI } from "@/lib/mctb/launch-flags";
import { useState } from "react";

type Props = {
  value: MctbRecoveryGoalId;
  messagePreview: string;
  onGoalChange: (goal: MctbRecoveryGoalId, suggestedMessage: string) => void;
  onMessageChange?: (message: string) => void;
};

export function MctbRecoveryGoalSetupSection({
  value,
  messagePreview,
  onGoalChange,
  onMessageChange,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-semibold text-foreground">Recovery goal</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Controls the recovery opener, request form fields, and link behavior. Same setting as onboarding.
        </p>
      </div>
      <MctbRecoveryGoalCards
        value={value}
        onChange={(id) => onGoalChange(id, getRecoveryGoalDefinition(id).defaultOpener)}
      />
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
        <p className="font-medium text-foreground">Recovery opener preview</p>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{messagePreview}</p>
        {MCTB_LAUNCH_GOAL_DRIVEN_RECOVERY_UI ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Launch templates are goal-driven. Full custom copy will be governed by messaging sender mode in a
            future release.
          </p>
        ) : null}
      </div>
      {MCTB_LAUNCH_GOAL_DRIVEN_RECOVERY_UI && onMessageChange ? (
        <div data-mctb-recovery-opener-editor>
          {/* Future PLATFORM/CUSTOMER sender mode: gate this block + POST /api/mctb/setup messageTemplate. */}
          <button
            type="button"
            className="text-[12px] font-semibold underline text-foreground"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Hide advanced customization" : "Advanced: customize opener"}
          </button>
          {showAdvanced ? (
            <label className="mt-2 block space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Custom opener (optional)</span>
              <textarea
                className="min-h-[88px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={messagePreview}
                onChange={(e) => onMessageChange(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
