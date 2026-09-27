"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import type {
  VoiceV3SolicitorPolicy,
  VoiceV3SpamLikelyPolicy,
} from "@/lib/voice-v3/spam-protection/types";
import { BlockedCallersManageDialog } from "@/components/voice/blocked-callers-manage-dialog";
import { Button } from "@/newui-transplant/components/ui/button";
import { RadioRow } from "@/components/solutions/appointment-receptionist/ui";
import type { WizardPresentation } from "@/components/solutions/appointment-receptionist/wizard-field-kit";
import { useCallback, useEffect, useState } from "react";

const SPAM_OPTIONS: Array<{
  value: VoiceV3SpamLikelyPolicy;
  title: string;
  recommended?: boolean;
  helper: string;
}> = [
  {
    value: "BLOCK",
    title: "Block automatically",
    recommended: true,
    helper:
      "Best for reducing spam and AI usage. Calls Telnyx identifies as likely spam are rejected before Amy answers.",
  },
  {
    value: "SCREEN",
    title: "Let Amy screen the call",
    helper:
      "Amy answers Spam Likely calls and handles legitimate callers normally.",
  },
  {
    value: "ALLOW",
    title: "Answer normally",
    helper: "Spam Likely calls are answered like any other call.",
  },
];

const SOLICITOR_OPTIONS: Array<{
  value: VoiceV3SolicitorPolicy;
  title: string;
  recommended?: boolean;
  helper: string;
}> = [
  {
    value: "DECLINE",
    title: "Politely decline and end the call",
    recommended: true,
    helper: "Amy ends confirmed sales solicitations with a brief polite close.",
  },
  {
    value: "TAKE_MESSAGE",
    title: "Take a message",
    helper: "Amy captures information without promising a callback unless your callback flow does.",
  },
  {
    value: "ALLOW",
    title: "Handle normally",
    helper: "No forced termination for solicitors.",
  },
];

function RadioGroup<T extends string>({
  name,
  value,
  options,
  onChange,
  presentation = "legacy",
}: {
  name: string;
  value: T | null | undefined;
  options: Array<{ value: T; title: string; recommended?: boolean; helper: string }>;
  onChange: (v: T) => void;
  presentation?: WizardPresentation;
}) {
  const selected = value ?? options[0]?.value;
  if (presentation === "opus") {
    return (
      <div className="space-y-2" role="radiogroup" aria-label={name}>
        {options.map((opt) => (
          <RadioRow
            key={opt.value}
            variant="opus"
            selected={selected === opt.value}
            onClick={() => onChange(opt.value)}
            label={
              opt.recommended ? `${opt.title} (Recommended)` : opt.title
            }
            description={opt.helper}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-3" role="radiogroup" aria-label={name}>
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
        >
          <input
            type="radio"
            name={name}
            className="mt-1"
            checked={selected === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="min-w-0 text-sm">
            <span className="font-medium text-foreground">
              {opt.title}
              {opt.recommended ? (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recommended
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{opt.helper}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function SpamUnwantedCallsEditor({
  state,
  patch,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: WizardPresentation;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);

  const refreshBlockedCount = useCallback(async () => {
    try {
      const res = await fetch("/api/voice/blocked-callers");
      const json = await res.json();
      if (res.ok) setBlockedCount(typeof json.count === "number" ? json.count : (json.data?.length ?? 0));
    } catch {
      setBlockedCount(null);
    }
  }, []);

  useEffect(() => {
    void refreshBlockedCount();
  }, [refreshBlockedCount]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Spam &amp; unwanted calls</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Reduce unwanted calls before they reach your receptionist. Helps block calls Telnyx
        identifies as likely spam (US/Canada reputation signals).
      </p>

      <div className="mt-4 space-y-6">
        <div>
          <p className="text-sm font-medium">Spam Likely calls</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose what happens when the phone network identifies an incoming call as likely spam.
          </p>
          <div className="mt-3">
            <RadioGroup
              name="spamLikelyPolicy"
              presentation={presentation}
              value={state.spamLikelyPolicy ?? "BLOCK"}
              options={SPAM_OPTIONS}
              onChange={(v) =>
                patch({
                  spamLikelyPolicy: v,
                  salesSolicitationEnabled: true,
                })
              }
            />
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">Sales &amp; solicitors</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When Amy realizes someone is calling to sell your business something:
          </p>
          <div className="mt-3">
            <RadioGroup
              name="solicitorPolicy"
              presentation={presentation}
              value={state.solicitorPolicy ?? "DECLINE"}
              options={SOLICITOR_OPTIONS}
              onChange={(v) =>
                patch({
                  solicitorPolicy: v,
                  salesSolicitationEnabled: true,
                  salesSolicitationAction:
                    v === "DECLINE" ? "DECLINE_POLITELY" : v === "TAKE_MESSAGE" ? "TAKE_MESSAGE" : "CONTINUE",
                })
              }
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Spam detection uses carrier reputation and caller verification signals. Some unwanted
          calls may not be identified, and legitimate calls can occasionally be flagged.
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="text-sm">
            <span className="font-medium text-foreground">Blocked callers</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {blockedCount == null
                ? "…"
                : `${blockedCount} number${blockedCount === 1 ? "" : "s"} blocked`}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setManageOpen(true)}
          >
            Manage
          </Button>
        </div>
      </div>
      <BlockedCallersManageDialog
        open={manageOpen}
        onClose={() => {
          setManageOpen(false);
          void refreshBlockedCount();
        }}
      />
    </div>
  );
}
