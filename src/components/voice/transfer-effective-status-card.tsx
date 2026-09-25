"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  deriveEffectiveTransferState,
  withTransferCallsCapability,
} from "@/lib/voice/call-handling/effective-transfer-state";
import { mctbVoiceAgentStepHref } from "@/lib/mctb/voice-agent/wizard-deep-links";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export function TransferEffectiveStatusCard({
  state,
  patch,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
}) {
  const effective = deriveEffectiveTransferState(state);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Can Amy transfer calls right now?</h2>
          <p
            className={`mt-1 text-sm font-medium ${
              effective.canAmyTransferNow ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-300"
            }`}
          >
            {effective.canAmyTransferNow ? "Yes — transfers are active." : "Not yet — finish the items below."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={effective.capabilityEnabled}
            onChange={(e) => patch(withTransferCallsCapability(state, e.target.checked))}
          />
          <span>Allow Amy to transfer calls</span>
        </label>
      </div>
      {!effective.canAmyTransferNow && effective.blockers.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {effective.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Transfers require the agent capability, the transfer switch below, and valid contacts. This
        matches what the live system compiles — not a separate setting.{" "}
        <Link href={mctbVoiceAgentStepHref("goals")} className="text-primary underline">
          Review agent goals
        </Link>
      </p>
    </Card>
  );
}
