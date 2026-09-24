"use client";

import {
  filterMctbWorkspaceSmsSenderOptions,
  formatWorkspaceSmsSenderOptionLabel,
  MCTB_SENDER_MODE_PLATFORM_DESCRIPTION,
  MCTB_SENDER_MODE_PLATFORM_TITLE,
  MCTB_SENDER_MODE_WORKSPACE_DESCRIPTION,
  MCTB_SENDER_MODE_WORKSPACE_TITLE,
  type MctbSetupPhoneOption,
} from "@/lib/mctb/sender-mode-ui";
import type { MctbSenderMode } from "@/lib/agents/missed-call-text-back/types";

type Props = {
  senderMode: MctbSenderMode;
  smsPhoneNumberId: string | null;
  phoneNumbers: MctbSetupPhoneOption[];
  disabled?: boolean;
  onChange: (next: { senderMode: MctbSenderMode; smsPhoneNumberId: string | null }) => void;
};

export function MctbTextMessageSenderSection({
  senderMode,
  smsPhoneNumberId,
  phoneNumbers,
  disabled,
  onChange,
}: Props) {
  const workspaceOptions = filterMctbWorkspaceSmsSenderOptions(phoneNumbers);
  const eligible = workspaceOptions.filter((o) => o.eligible);
  const selectedEligible = eligible.some((o) => o.id === smsPhoneNumberId);

  function setMode(mode: MctbSenderMode) {
    if (mode === "PLATFORM") {
      onChange({ senderMode: "PLATFORM", smsPhoneNumberId });
      return;
    }
    const fallback = selectedEligible
      ? smsPhoneNumberId
      : eligible[0]?.id ?? smsPhoneNumberId;
    onChange({ senderMode: "WORKSPACE", smsPhoneNumberId: fallback });
  }

  return (
    <section className="space-y-4" aria-labelledby="mctb-text-message-sender-title">
      <div>
        <h3 id="mctb-text-message-sender-title" className="text-base font-semibold text-foreground">
          Text message sender
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Choose how missed-call text messages are sent. This is separate from your call-forwarding
          number, which only receives forwarded voice calls.
        </p>
      </div>

      <fieldset className="space-y-3 border-0 p-0 m-0" disabled={disabled}>
        <legend className="sr-only">Text message sender mode</legend>

        <label
          className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${
            senderMode === "PLATFORM" ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <input
            type="radio"
            name="mctb-sender-mode"
            className="mt-1"
            checked={senderMode === "PLATFORM"}
            onChange={() => setMode("PLATFORM")}
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-foreground">{MCTB_SENDER_MODE_PLATFORM_TITLE}</span>
            <span className="text-[13px] text-muted-foreground">{MCTB_SENDER_MODE_PLATFORM_DESCRIPTION}</span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${
            senderMode === "WORKSPACE" ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <input
            type="radio"
            name="mctb-sender-mode"
            className="mt-1"
            checked={senderMode === "WORKSPACE"}
            onChange={() => setMode("WORKSPACE")}
          />
          <span className="flex flex-col gap-1 w-full min-w-0">
            <span className="text-sm font-semibold text-foreground">{MCTB_SENDER_MODE_WORKSPACE_TITLE}</span>
            <span className="text-[13px] text-muted-foreground">{MCTB_SENDER_MODE_WORKSPACE_DESCRIPTION}</span>

            {senderMode === "WORKSPACE" ? (
              <div className="mt-3 space-y-1.5">
                <span className="text-xs font-semibold text-[#374151]" id="mctb-workspace-sender-label">
                  Choose a sender
                </span>
                {workspaceOptions.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    No workspace numbers available. Complete messaging verification for a toll-free or 10DLC
                    number first.
                  </p>
                ) : (
                  <select
                    id="mctb-workspace-sender"
                    className="flex h-10 w-full max-w-md rounded-lg border border-input bg-background px-3 text-sm"
                    aria-labelledby="mctb-workspace-sender-label"
                    value={smsPhoneNumberId || ""}
                    onChange={(e) =>
                      onChange({
                        senderMode: "WORKSPACE",
                        smsPhoneNumberId: e.target.value || null,
                      })
                    }
                  >
                    <option value="" disabled={eligible.length > 0}>
                      Select verified number
                    </option>
                    {workspaceOptions.map((opt) => (
                      <option key={opt.id} value={opt.id} disabled={!opt.eligible}>
                        {formatWorkspaceSmsSenderOptionLabel(opt)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}
          </span>
        </label>
      </fieldset>
    </section>
  );
}
