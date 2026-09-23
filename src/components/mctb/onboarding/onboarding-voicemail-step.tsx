"use client";

import { MctbVoicemailSetupSection } from "@/components/mctb/voicemail-setup-section";
import { useState } from "react";

type Props = {
  phoneNumberId: string | null;
  press1Mode: boolean;
  onPlatformDefault: () => void | Promise<void>;
  onContinue: () => void | Promise<void>;
};

export function OnboardingVoicemailStep({
  phoneNumberId,
  press1Mode,
  onPlatformDefault,
  onContinue,
}: Props) {
  const [mode, setMode] = useState<"default" | "custom">("default");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`mctb-setup-btn ${mode === "default" ? "mctb-setup-btn--primary" : "mctb-setup-btn--outline"}`}
          onClick={() => setMode("default")}
        >
          Use Transovo default
        </button>
        <button
          type="button"
          className={`mctb-setup-btn ${mode === "custom" ? "mctb-setup-btn--primary" : "mctb-setup-btn--outline"}`}
          onClick={() => setMode("custom")}
        >
          Customize greeting
        </button>
      </div>

      {mode === "default" ? (
        <div className="rounded-lg border border-[#e8eaed] p-4 text-[13px] text-[#3a3f47]">
          <p className="font-semibold">Platform default greeting</p>
          <p className="mt-2 text-[#626872]">
            Callers always hear a production-safe Transovo greeting. You can customize later in Setup →
            Voicemail.
          </p>
          <button
            type="button"
            className="mctb-setup-btn mctb-setup-btn--primary mt-4"
            onClick={() => void onPlatformDefault()}
          >
            Use default greeting
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-[#e8eaed] p-2">
          <MctbVoicemailSetupSection phoneNumberId={phoneNumberId} />
          <p className="px-3 pb-3 text-[12px] text-[#626872]">
            Generate with AI voice, record yourself, or upload audio — then save to activate.
          </p>
        </div>
      )}

      <aside className="mctb-onb-aside">
        <h2 className="mctb-onb-aside__title">Call ending</h2>
        <p className="text-[12.5px] leading-relaxed text-[#626872]">
          {press1Mode
            ? "If the caller does not press 1, they hear your voicemail greeting and can leave a message."
            : "Callers reach voicemail according to your configured call flow after the missed call."}
        </p>
      </aside>

      <button type="button" className="mctb-setup-btn mctb-setup-btn--outline" onClick={() => void onContinue()}>
        Continue
      </button>
    </div>
  );
}
