"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Lock } from "lucide-react";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { listMctbPlatformRecoveryOpenerChoices } from "@/lib/mctb/platform-recovery-template-choices";
import { formatCarrierStep } from "@/lib/mctb/onboarding/carriers";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { existingConsentIneligibleReason } from "@/lib/mctb/setup-consent-eligibility";
import { clientPlatformVoicemailGreetingPreviewPath } from "@/lib/phone/voicemail-greeting-defaults";
import { buildOnboardingLiveTestSteps } from "@/lib/mctb/onboarding/live-test-presentation";
import { MctbConsentPromptPanel } from "@/newui-transplant/components/mctb/mctb-consent-prompt-panel";
import { MctbVoicemailGreetingStudio } from "@/newui-transplant/components/mctb/mctb-voicemail-greeting-studio";
import { Pill, Rows } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { cn } from "@/lib/utils";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import type { MctbOnboardingController } from "@/newui-transplant/connected/mctb/mctb-onboarding-opus-view";
import {
  useMctbWizardFooter,
  WizardStepIntro,
} from "@/newui-transplant/connected/mctb/mctb-onboarding-wizard-shell";
import {
  OnboardingNotificationsStep,
  useOnboardingRecoveryBundle,
} from "@/newui-transplant/connected/mctb/mctb-onboarding-operational-steps";
import { useMctbTestWiring } from "@/newui-transplant/connected/mctb/setup-wiring-hooks";
import { useMctbVoicemailWiring } from "@/newui-transplant/connected/mctb/setup-wiring-hooks";
function SelectionRow({
  selected,
  disabled,
  title,
  subtitle,
  badge,
  onSelect,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  subtitle: string;
  badge?: string;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          OPUS_CARD,
          "flex w-full items-start gap-3 px-4 py-3 text-left transition",
          selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-muted/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-primary bg-primary" : "border-muted-foreground/40",
          )}
          aria-hidden
        >
          {selected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{title}</span>
            {badge ? (
              <span className="text-[11px] font-medium text-muted-foreground">{badge}</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
        </span>
        {disabled ? <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </button>
      {selected ? children : null}
    </div>
  );
}

export function WizardBusinessStep({ c }: { c: MctbOnboardingController }) {
  const provisioned = c.data?.trialNumber.provisioned;
  const forwardReady = provisioned && Boolean(c.forwardE164);

  useMctbWizardFooter({
    back: false,
    primary: {
      label: "Continue",
      disabled: !c.businessName.trim() || !c.businessNumber.trim(),
      onClick: () =>
        void c.post({
          businessName: c.businessName.trim(),
          websiteUrl: c.websiteUrl.trim(),
          businessNumberE164: c.businessNumber.trim(),
          forwardingCarrier: c.carrier,
        }),
    },
  });

  return (
    <>
      <WizardStepIntro
        eyebrow="Step 1"
        title="Tell us about your business"
        description="We'll use this information to set up missed-call recovery for your existing business number."
      />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="onb-biz-name">Business name</Label>
          <Input
            id="onb-biz-name"
            value={c.businessName}
            onChange={(e) => c.setBusinessName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onb-biz-phone">Business phone number</Label>
          <Input
            id="onb-biz-phone"
            type="tel"
            value={c.businessNumber}
            onChange={(e) => c.setBusinessNumber(e.target.value)}
            placeholder="(571) 555-0188"
          />
          <p className="text-xs text-muted-foreground">The number your customers already call.</p>
        </div>
      </div>
      <div className="mt-8 border-t pt-6">
        <Rows
          items={[
            {
              label: "Transovo forwarding number",
              value: forwardReady ? (
                <span className="font-medium">{c.forwardDisplay}</span>
              ) : (
                <span className="text-muted-foreground">Setting up your number…</span>
              ),
            },
            {
              label: "Status",
              value: (
                <Pill tone={forwardReady ? "success" : "warning"} dot={false}>
                  {forwardReady ? "Ready" : "Setting up"}
                </Pill>
              ),
            },
          ]}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          We&apos;ll show you how to connect your business phone near the end of setup.
        </p>
      </div>
    </>
  );
}

export function WizardConsentStep({ c }: { c: MctbOnboardingController }) {
  const phoneNumberId = c.data?.trialNumber.phoneNumberId ?? null;

  useMctbWizardFooter({
    back: true,
    primary: {
      label: "Continue",
      disabled: c.consentMode === "existing_consent" && !c.existingConsentAttested,
      onClick: () =>
        void c.post({
          consentMode: c.consentMode,
          existingConsentAttested: c.consentMode === "existing_consent" ? true : undefined,
        }),
    },
  });

  return (
    <>
      <WizardStepIntro
        eyebrow="Step 2"
        title="How should callers receive a text?"
        description="Choose how Transovo confirms permission before sending a missed-call follow-up."
      />
      {!c.existingConsentEligible ? (
        <p className="mb-4 text-xs text-muted-foreground">{existingConsentIneligibleReason(false)}</p>
      ) : null}
      <div className="space-y-4">
        <SelectionRow
          selected={c.consentMode === "press_1"}
          title="Press 1"
          subtitle="When you don't answer, the caller hears a short disclosure and presses 1 to receive your follow-up text."
          badge="Recommended"
          onSelect={() => c.setConsentMode("press_1")}
        />
        {c.consentMode === "press_1" ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <MctbConsentPromptPanel phoneNumberId={phoneNumberId} />
          </div>
        ) : null}
        <SelectionRow
          selected={c.consentMode === "existing_consent"}
          disabled={!c.existingConsentEligible}
          title="I already have consent"
          subtitle="For businesses that already maintain the required permission to text callers."
          badge={c.existingConsentEligible ? undefined : "Recovery required"}
          onSelect={() => c.setConsentMode("existing_consent")}
        >
          <label className="ml-7 flex items-start gap-2 text-sm">
            <Checkbox
              checked={c.existingConsentAttested}
              onCheckedChange={(v) => c.setExistingConsentAttested(Boolean(v))}
            />
            <span>I confirm my business already has permission to text these callers.</span>
          </label>
        </SelectionRow>
      </div>
    </>
  );
}

export function WizardTextBackStep({ c }: { c: MctbOnboardingController }) {
  const recoveryBundle = useOnboardingRecoveryBundle();
  const platformSender = Boolean(c.capabilities?.platformSenderActive);
  const platformTemplates = listMctbPlatformRecoveryOpenerChoices();
  const selectedId =
    platformTemplates.find((t) => t.body === c.messageTemplate)?.id ?? platformTemplates[0]?.id;

  useMctbWizardFooter({
    back: true,
    primary: {
      label: "Continue",
      disabled: !c.messageTemplate.trim(),
      onClick: () =>
        void (async () => {
          await recoveryBundle.saveAll(c.messageTemplate.trim());
          await c.post({ messageTemplate: c.messageTemplate.trim() });
        })(),
    },
  });

  return (
    <>
      <WizardStepIntro
        eyebrow="Step 3"
        title="Choose your missed-call text"
        description="This is the first message callers receive after a qualifying missed call."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Sending from</span>
        <span className="font-medium">{c.senderPresentation?.title ?? "Transovo Platform"}</span>
      </div>
      {platformSender ? (
        <div className="space-y-2">
          {platformTemplates.map((tpl) => (
            <label
              key={tpl.id}
              className={cn(
                "flex cursor-pointer gap-3 rounded-lg border px-4 py-3",
                selectedId === tpl.id ? "border-primary ring-1 ring-primary/25" : "",
              )}
            >
              <input
                type="radio"
                name="platform-template"
                className="mt-1"
                checked={selectedId === tpl.id}
                onChange={() => c.setMessageTemplate(tpl.body)}
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm font-medium">{tpl.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">&ldquo;{tpl.body}&rdquo;</span>
              </span>
              {selectedId === tpl.id ? (
                <span className="text-xs font-medium text-muted-foreground">Selected</span>
              ) : null}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Loading sender configuration…</p>
      )}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
        <div className="mt-2 max-w-sm rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">{c.messageTemplate}</div>
      </div>
      <div className="mt-8 flex items-start gap-2 border-t pt-6 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Write your own recovery message</span> — available when using an
          eligible verified business sender. Configure in Setup after onboarding.
        </span>
      </div>
    </>
  );
}

export function WizardVoicemailStep({ c }: { c: MctbOnboardingController }) {
  const vm = useMctbVoicemailWiring();
  const [mode, setMode] = useState<"default" | "custom">(vm.greetingUrl ? "custom" : "default");
  const platformPreview = clientPlatformVoicemailGreetingPreviewPath();

  useEffect(() => {
    if (vm.greetingUrl) setMode("custom");
  }, [vm.greetingUrl]);

  const ensureDefault = useCallback(async () => {
    if (!vm.phoneNumberId) return;
    await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_number_box", phoneNumberId: vm.phoneNumberId }),
    });
  }, [vm.phoneNumberId]);

  useMctbWizardFooter({
    back: true,
    primary: {
      label: "Continue",
      disabled: vm.loading,
      onClick: () =>
        void (async () => {
          if (mode === "default") await ensureDefault();
          await c.post({ action: "mark_voicemail_configured" });
        })(),
    },
  });

  return (
    <>
      <WizardStepIntro
        eyebrow="Step 4"
        title="Choose your voicemail greeting"
        description="Callers can leave a message when you can't answer."
      />
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current greeting</p>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="vm-mode"
            checked={mode === "default"}
            onChange={() => setMode("default")}
          />
          Use default greeting
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="vm-mode"
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
          />
          Personalize greeting
        </label>
      </div>
      {mode === "default" ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">Transovo default — no extra setup required.</p>
          <audio className="w-full max-w-md" controls src={platformPreview} />
        </div>
      ) : (
        <div className="mt-4">
          <MctbVoicemailGreetingStudio
            greetingText={vm.greetingText}
            greetingUrl={vm.greetingUrl}
            greetingActive={vm.greetingActive}
            greetingCustomActive={vm.greetingCustomActive}
            onSaveText={vm.saveGreeting}
            onSaveUrl={vm.saveGreetingUrl}
            onUsePlatformDefault={vm.usePlatformDefaultGreeting}
          />
        </div>
      )}
    </>
  );
}

export function WizardNotificationsStep({ c, caps }: { c: MctbOnboardingController; caps: MctbCapabilities | null }) {
  return <OnboardingNotificationsStep c={c} caps={caps} compact />;
}

export function WizardConnectPhoneStep({ c }: { c: MctbOnboardingController }) {
  const [ack, setAck] = useState(false);
  const selectedCarrier = c.data?.carriers.find((x) => x.id === c.carrier);
  const carriers = c.data?.carriers ?? [];

  const copyForward = () => {
    if (!c.forwardE164) return;
    void navigator.clipboard.writeText(c.forwardE164);
  };

  useMctbWizardFooter({
    back: true,
    primary: {
      label: "I've set up forwarding",
      disabled: !ack || !c.businessNumber.trim(),
      onClick: () =>
        void (async () => {
          await c.post({
            forwardingCarrier: c.carrier,
            businessNumberE164: c.businessNumber,
            forwardingRingSeconds: c.forwardRingSeconds,
            action: "complete_connect_phone",
          });
        })(),
    },
  });

  return (
    <>
      <WizardStepIntro
        eyebrow="Step 6"
        title="Connect your business phone"
        description="Your setup is ready. Now forward only unanswered calls to your Transovo number."
      />
      <div className="flex flex-wrap items-center gap-2 text-center text-sm">
        <div className="min-w-[120px] flex-1 rounded-lg border px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Your business number</p>
          <p className="font-medium">{c.businessNumber ? formatMctbPhoneLabel(c.businessNumber) : "—"}</p>
        </div>
        <span className="text-muted-foreground">→</span>
        <div className="min-w-[100px] flex-1 rounded-lg border px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Rings normally</p>
        </div>
        <span className="text-muted-foreground">→</span>
        <div className="min-w-[100px] flex-1 rounded-lg border px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">No answer</p>
        </div>
        <span className="text-muted-foreground">→</span>
        <div className="min-w-[120px] flex-1 rounded-lg border px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Transovo</p>
          <p className="font-medium">{c.forwardDisplay}</p>
          {c.forwardE164 ? (
            <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 gap-1 px-2" onClick={copyForward}>
              <Copy className="size-3" aria-hidden />
              Copy
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Use conditional / no-answer forwarding. Your phone should continue ringing normally. Only unanswered calls should
        reach Transovo.
      </p>
      <h3 className="mt-8 text-sm font-semibold">How do you receive business calls?</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {carriers.map((car) => (
          <button
            key={car.id}
            type="button"
            onClick={() => c.setCarrier(car.id as MctbForwardingCarrier)}
            className={cn(
              "rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition",
              c.carrier === car.id ? "border-primary ring-1 ring-primary/25" : "hover:border-muted-foreground/30",
            )}
          >
            {car.label}
          </button>
        ))}
      </div>
      {selectedCarrier ? (
        <div className="mt-6 text-sm">
          <p className="font-medium">{selectedCarrier.label} — No-answer forwarding</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            {selectedCarrier.steps.slice(0, 8).map((s, i) => (
              <li key={i}>
                {formatCarrierStep(s, {
                  transovoE164: c.forwardE164 ?? "",
                  forwardRingSeconds: c.forwardRingSeconds,
                })}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <label className="mt-6 flex items-start gap-2 text-sm">
        <Checkbox checked={ack} onCheckedChange={(v) => setAck(Boolean(v))} />
        <span>I&apos;ve set up no-answer forwarding</span>
      </label>
    </>
  );
}

export function WizardTestStep({ c }: { c: MctbOnboardingController }) {
  const test = useMctbTestWiring();
  const press1 = c.consentMode === "press_1";
  const liveChecks = test.liveTest?.checks ?? c.data?.liveTest.checks ?? {};
  const timeline = buildOnboardingLiveTestSteps({
    checks: {
      callDetected: Boolean(liveChecks.callDetected),
      forwardingVerified: Boolean(liveChecks.forwardingVerified),
      missedCall: Boolean(liveChecks.missedCall),
      consentCompleted: Boolean(liveChecks.consentCompleted),
      textSent: Boolean(liveChecks.textSent),
      textDelivered: Boolean(liveChecks.textDelivered),
      replyReceived: Boolean(liveChecks.replyReceived),
    },
    consentMode: press1 ? "press_1" : "existing_consent",
  });
  const passed = Boolean(test.liveTest?.passed || c.data?.liveTest.passed);
  const started = Boolean(test.liveTest?.started);

  useMctbWizardFooter({
    back: true,
    primary: passed
      ? {
          label: "Go to Missed Calls",
          onClick: () => {
            if (c.presentation === "modal" && c.onFinished) c.onFinished();
            else c.router.push(MCTB_ROUTES.missedCalls);
          },
        }
      : {
          label: started ? "Try again" : "Start test",
          onClick: () => void test.startLiveTest().catch(() => undefined),
        },
    secondary: passed
      ? {
          label: "Review Setup",
          onClick: () => {
            if (c.presentation === "modal" && c.onFinished) c.onFinished();
            c.router.push(`${MCTB_ROUTES.missedCallRecovery}?tab=general`);
          },
        }
      : !started
        ? undefined
        : {
            label: "Check forwarding instructions",
            onClick: () => void c.post({ step: "connect_calls" }),
          },
  });

  const bizDisplay =
    test.businessLine || (c.businessNumber ? formatMctbPhoneLabel(c.businessNumber) : "your business number");

  if (passed) {
    return (
      <>
        <WizardStepIntro title="You're ready" description="Missed Call Text Back is connected and working." />
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between gap-4 border-b py-2">
            <span className="text-muted-foreground">Business phone</span>
            <span className="font-medium">{bizDisplay}</span>
          </li>
          <li className="flex justify-between gap-4 border-b py-2">
            <span className="text-muted-foreground">Forwarding</span>
            <span className="font-medium">
              {c.data?.forwardingVerification?.verified ? "Connected" : "Pending verification"}
            </span>
          </li>
          <li className="flex justify-between gap-4 border-b py-2">
            <span className="text-muted-foreground">Consent</span>
            <span className="font-medium">{press1 ? "Press 1" : "Existing permission"}</span>
          </li>
          <li className="flex justify-between gap-4 border-b py-2">
            <span className="text-muted-foreground">Text back</span>
            <span className="font-medium">{c.senderPresentation?.title ?? "Transovo Platform"}</span>
          </li>
          <li className="flex justify-between gap-4 border-b py-2">
            <span className="text-muted-foreground">Voicemail</span>
            <span className="font-medium">{c.data?.state.voicemailConfiguredAt ? "Configured" : "Default"}</span>
          </li>
        </ul>
        <p className="mt-4 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          Live test passed
        </p>
      </>
    );
  }

  return (
    <>
      <WizardStepIntro
        eyebrow="Step 7"
        title="Let's make sure everything works"
        description="Call your business number from another phone and let it ring without answering."
      />
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-center">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Call</p>
        <p className="text-xl font-semibold tracking-tight">{bizDisplay}</p>
      </div>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Call your business number from another phone.</li>
        <li>Let it ring. Don&apos;t answer.</li>
        <li>
          {press1
            ? "When Transovo answers, press 1 when prompted."
            : "When Transovo answers, let the voicemail greeting play."}
        </li>
        <li>Confirm the recovery text arrives.</li>
        <li>Reply to the text so we can verify the conversation.</li>
      </ol>
      {started ? (
        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium">What Transovo observes</p>
          <ul className="space-y-1.5" aria-live="polite">
            {timeline.map((row) => (
              <li key={row.id} className="flex items-center gap-2 text-sm">
                <Pill tone={row.done ? "success" : "neutral"} dot={false}>{row.done ? "✓" : "○"}</Pill>
                <span className={row.done ? "text-foreground" : "text-muted-foreground"}>{row.label}</span>
              </li>
            ))}
          </ul>
          {started && !liveChecks.forwardingVerified ? (
            <p className="mt-3 text-sm text-muted-foreground">
              We haven&apos;t seen a call forwarded from your business line yet. Call{' '}
              <span className="font-medium text-foreground">{bizDisplay}</span> from another phone and let it ring
              without answering.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
