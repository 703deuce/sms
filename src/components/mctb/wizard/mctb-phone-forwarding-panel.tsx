"use client";

import type { CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import { formatCarrierStep } from "@/lib/mctb/onboarding/carriers";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import { Input } from "@/components/ui/input";
import {
  MctbConnectionStatusCard,
  MctbVerificationTimeline,
  MctbWalkthroughModeToggle,
  SelectableCard,
  WizardPageLayout,
  WizardQuestionBlock,
} from "@/components/mctb/wizard/mctb-wizard-ui";
import { cn } from "@/lib/utils";
import { Phone, Radio } from "lucide-react";
import { useState } from "react";

type Verification = {
  testStarted: boolean;
  callDetected: boolean;
  verified: boolean;
} | null;

type Props = {
  businessNumber: string;
  onBusinessNumberChange: (v: string) => void;
  carrier: MctbForwardingCarrier;
  onCarrierChange: (c: MctbForwardingCarrier) => void;
  carriers: CarrierForwardingGuide[];
  forwardDisplay: string;
  forwardE164: string | null;
  forwardRingSeconds: number;
  onForwardRingSecondsChange: (n: number) => void;
  verification: Verification;
  connectionStatus?: "ready" | "pending" | "attention" | "unknown";
};

export function MctbPhoneForwardingPanel({
  businessNumber,
  onBusinessNumberChange,
  carrier,
  onCarrierChange,
  carriers,
  forwardDisplay,
  forwardE164,
  forwardRingSeconds,
  onForwardRingSecondsChange,
  verification,
  connectionStatus = "unknown",
}: Props) {
  const [walkthroughMode, setWalkthroughMode] = useState<"guided" | "instructions">("guided");
  const selectedCarrier = carriers.find((c) => c.id === carrier);

  const verificationSteps = [
    {
      id: "start",
      label: "Start verification",
      detail: "Call your business line from another phone and let it ring unanswered.",
      done: Boolean(verification?.testStarted),
    },
    {
      id: "reach",
      label: `Call reaches Transovo (${forwardDisplay})`,
      done: Boolean(verification?.callDetected),
      active: Boolean(verification?.testStarted && !verification?.callDetected),
    },
    {
      id: "forward",
      label: "Forwarded from your business line",
      detail: "ANI should match your public business number when supported.",
      done: Boolean(verification?.verified),
      active: Boolean(verification?.callDetected && !verification?.verified),
    },
  ];

  return (
    <WizardPageLayout
      aside={
        <div className="space-y-4">
          <MctbConnectionStatusCard
            rows={[
              {
                label: "Business line",
                value: businessNumber || "Not set",
                mono: true,
                status: businessNumber ? "ready" : "attention",
              },
              {
                label: "Carrier / provider",
                value: selectedCarrier?.label || "Select carrier",
                status: selectedCarrier ? "ready" : "pending",
              },
              {
                label: "Forwarding destination",
                value: forwardE164 ? forwardDisplay : "Assign MCTB number first",
                mono: true,
                status: forwardE164 ? "ready" : "attention",
              },
              {
                label: "Connection",
                value:
                  verification?.verified
                    ? "Verified"
                    : verification?.testStarted
                      ? "Verification in progress"
                      : "Not verified",
                status: connectionStatus,
              },
            ]}
          />
          {verification?.testStarted ? (
            <MctbVerificationTimeline
              title="Forwarding verification"
              steps={verificationSteps}
              passed={verification?.verified}
              passedTitle="Forwarding verified"
              waitingHint={
                verification?.verified
                  ? undefined
                  : "Checkpoints update automatically when your test call completes."
              }
            />
          ) : null}
        </div>
      }
    >
      <WizardQuestionBlock
        number={1}
        title="Your public business number"
        subtitle="Customers call this number today. Transovo never replaces it — you forward unanswered calls to a hidden ingress."
      >
        <Input
          value={businessNumber}
          onChange={(e) => onBusinessNumberChange(e.target.value)}
          placeholder="(540) 555-1234"
          className="h-11 max-w-md text-[15px]"
          aria-label="Business phone number"
        />
      </WizardQuestionBlock>

      <WizardQuestionBlock
        number={2}
        title="Phone service provider"
        subtitle="We show carrier-specific forwarding steps. Pick the network that bills your business line."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {carriers.map((c) => (
            <SelectableCard
              key={c.id}
              compact
              selected={carrier === c.id}
              onClick={() => onCarrierChange(c.id)}
              title={c.label}
              icon={<Radio className="h-4 w-4" aria-hidden />}
            />
          ))}
        </div>
      </WizardQuestionBlock>

      {selectedCarrier && forwardE164 ? (
        <>
          <WizardQuestionBlock
            number={3}
            title="Set up conditional forwarding"
            subtitle="Forward unanswered calls to Transovo. Do not disable your business line."
          >
            <MctbWalkthroughModeToggle mode={walkthroughMode} onChange={setWalkthroughMode} />
          </WizardQuestionBlock>

          {walkthroughMode === "guided" ? (
            <WizardQuestionBlock
              number={4}
              title="Ring timing"
              subtitle="Must ring long enough to forward before voicemail answers."
              optional
            >
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="mctb-forward-ring"
                    className="mb-1 block text-xs font-semibold text-[#374151]"
                  >
                    Seconds before forward
                  </label>
                  <Input
                    id="mctb-forward-ring"
                    type="number"
                    min={10}
                    max={30}
                    value={forwardRingSeconds}
                    onChange={(e) => onForwardRingSecondsChange(Number(e.target.value) || 15)}
                    className="h-10 w-24"
                  />
                </div>
                <p className="text-[12px] text-[#6b7280]">
                  Recommended: {selectedCarrier.capabilities.recommendedForwardRingSeconds}s
                </p>
              </div>
            </WizardQuestionBlock>
          ) : null}

          <div className="wizard-question-block">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
              Carrier instructions
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-[#374151]">
              {selectedCarrier.steps.map((s) => {
                const text = formatCarrierStep(s, {
                  transovoE164: forwardE164,
                  forwardRingSeconds,
                });
                return <li key={s}>{text}</li>;
              })}
            </ol>
            {selectedCarrier.capabilities.alternateSetupRequired ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
                {selectedCarrier.capabilities.alternateSetupNote}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <div
          className={cn(
            "rounded-xl border border-dashed border-[#e6e8ef] bg-[#f8f9fc] px-4 py-6 text-center text-[13px] text-[#6b7280]",
          )}
        >
          <Phone className="mx-auto mb-2 h-8 w-8 text-[#9ca3af]" aria-hidden />
          Assign your MCTB number to see the forwarding destination and carrier steps.
        </div>
      )}
    </WizardPageLayout>
  );
}
