"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, FileCheck, Lock, ShieldCheck } from "lucide-react";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import { listMctbPlatformRecoveryOpenerChoices } from "@/lib/mctb/platform-recovery-template-choices";
import type { CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import { formatCarrierStep } from "@/lib/mctb/onboarding/carriers";
import type {
  MctbConsentMode,
  MctbForwardingCarrier,
  MctbOnboardingStep,
} from "@/lib/mctb/onboarding/types";
import { MCTB_WIZARD_PRIMARY_LABELS, MCTB_WIZARD_PRIMARY_STEPS } from "@/lib/mctb/onboarding/wizard-flow";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { existingConsentIneligibleReason } from "@/lib/mctb/setup-consent-eligibility";
import { getRecoveryGoalDefinition, type MctbRecoveryGoalId } from "@/lib/mctb/recovery-goals";
import Link from "next/link";
import { useState } from "react";
import {
  OnboardingNotificationsStep,
  OnboardingRecoveryControlsSection,
  OnboardingVoicemailStep,
  useOnboardingRecoveryBundle,
} from "@/newui-transplant/connected/mctb/mctb-onboarding-operational-steps";
import {
  MctbNumberDrawerOpus,
  type MctbNumberDrawerMode,
} from "@/newui-transplant/components/mctb/number-drawer-opus";
import { EmptyState, FieldRow, Panel, Pill, Rows } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { Textarea } from "@/newui-transplant/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";
import { cn } from "@/lib/utils";

export type MctbOnboardingController = {
  data: {
    state: { currentStep: string; forwardingTestStartedAt?: string | null };
    trialNumber: {
      provisioned: boolean;
      display: string | null;
      tfvStatusLabel: string;
      messagingVerificationStatus: string;
      phoneNumberId?: string | null;
    };
    carriers: CarrierForwardingGuide[];
    forwardingVerification: {
      testStarted: boolean;
      callDetected?: boolean;
      verified: boolean;
    } | null;
    liveTest: { passed: boolean; checks: Record<string, boolean> };
    tfv: { status: string; approved: boolean; failureReason?: string | null };
    trial?: { daysRemaining?: number };
  } | null;
  saving: boolean;
  error: string | null;
  existingConsentEligible: boolean;
  businessName: string;
  setBusinessName: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  businessNumber: string;
  setBusinessNumber: (v: string) => void;
  carrier: MctbForwardingCarrier;
  setCarrier: (c: MctbForwardingCarrier) => void;
  messageTemplate: string;
  setMessageTemplate: (v: string) => void;
  recoveryGoal: MctbRecoveryGoalId;
  setRecoveryGoal: (id: MctbRecoveryGoalId) => void;
  consentMode: MctbConsentMode;
  setConsentMode: (m: MctbConsentMode) => void;
  existingConsentAttested: boolean;
  setExistingConsentAttested: (v: boolean) => void;
  forwardRingSeconds: number;
  setForwardRingSeconds: (n: number) => void;
  setForwardingTestActive: (v: boolean) => void;
  drawerMode: MctbNumberDrawerMode;
  setDrawerMode: (m: MctbNumberDrawerMode) => void;
  step: MctbOnboardingStep;
  stageIndex: number;
  load: () => Promise<void>;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  previousStep: MctbOnboardingStep | null;
  forwardE164: string | null | undefined;
  forwardDisplay: string;
  tfvApproved: boolean;
  usesA2pPath: boolean;
  router: ReturnType<typeof useRouter>;
  presentation: "page" | "modal";
  onFinished?: () => void;
  capabilities: MctbCapabilities | null;
  senderPresentation: { title: string; description: string } | null;
};

function OpusProgress({ currentIndex }: { currentIndex: number }) {
  return (
    <nav aria-label="Onboarding progress" className="mb-6">
      <ol className="flex flex-wrap gap-2">
        {MCTB_WIZARD_PRIMARY_STEPS.map((id, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={id}>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                  active ? "bg-accent text-accent-foreground ring-primary/30" : done ? "bg-muted text-foreground ring-border" : "text-muted-foreground ring-border",
                )}
              >
                <span aria-hidden>{index + 1}</span>
                {MCTB_WIZARD_PRIMARY_LABELS[id]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function OpusVerificationTimeline({
  title,
  passed,
  passedTitle,
  waitingHint,
  steps,
}: {
  title: string;
  passed?: boolean;
  passedTitle?: string;
  waitingHint?: string;
  steps: { id: string; label: string; done: boolean }[];
}) {
  return (
    <div className="mt-6 rounded-lg border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {passed ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {passedTitle || "All checkpoints complete"}
        </p>
      ) : waitingHint ? (
        <p className="mt-1 text-xs text-muted-foreground">{waitingHint}</p>
      ) : null}
      <ol className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 text-sm">
            <Pill tone={step.done ? "success" : "neutral"} dot={false}>
              {step.done ? "Done" : "Waiting"}
            </Pill>
            <span className="text-muted-foreground">{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepFooter({
  c,
  back,
  primary,
}: {
  c: MctbOnboardingController;
  back?: boolean;
  primary?: { label: string; disabled?: boolean; onClick: () => void };
}) {
  return (
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div>
        {back && c.previousStep ? (
          <Button type="button" variant="outline" disabled={c.saving} onClick={() => void c.post({ step: c.previousStep })}>
            Back
          </Button>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground">{c.saving ? "Saving…" : null}</span>
      {primary ? (
        <Button type="button" disabled={c.saving || primary.disabled} onClick={primary.onClick}>
          {primary.label}
        </Button>
      ) : null}
    </footer>
  );
}

function ReviewTestOpusStep({ c }: { c: MctbOnboardingController }) {
  const checklist: { label: string; value: string; jump: MctbOnboardingStep }[] = [
    ["Business line", c.businessNumber ? formatMctbPhoneLabel(c.businessNumber) : "—", "business_line"],
    ["Forwarding", c.data?.forwardingVerification?.verified ? "Verified" : "Not verified", "connect_calls"],
    ["Consent", c.consentMode === "press_1" ? "Press 1" : "Existing consent", "consent"],
    ["Recovery message", c.messageTemplate ? "Configured" : "—", "recovery"],
    ["Notifications", "Configured", "notifications"],
    ["Messaging", c.tfvApproved ? "Ready" : "Pending", "recovery"],
  ].map(([label, value, jump]) => ({ label, value, jump: jump as MctbOnboardingStep }));

  const press1 = c.consentMode === "press_1";

  return (
    <Panel
      title="Test your setup"
      description={`Call ${c.businessNumber ? formatMctbPhoneLabel(c.businessNumber) : "your business line"} from another phone to verify the live path.`}
    >
      <div className="rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Live test procedure</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Call your business number from another phone.</li>
          <li>Do not answer the business line.</li>
          <li>Wait for the call to forward to Transovo.</li>
          {press1 ? (
            <>
              <li>Listen to the consent disclosure and press 1.</li>
              <li>Wait for the recovery text on that phone.</li>
            </>
          ) : (
            <li>Let the voicemail greeting play (recovery texts send per your consent mode).</li>
          )}
          <li>Reply to the recovery text to confirm two-way messaging.</li>
        </ol>
      </div>
      <ul className="mt-4 divide-y rounded-lg border">
        {checklist.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{row.value}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => void c.post({ step: row.jump })}>
                Edit
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={c.saving}
          onClick={async () => {
            await fetch("/api/mctb/live-test", { method: "POST" });
            await c.load();
          }}
        >
          Run live test
        </Button>
        {!c.data?.forwardingVerification?.verified ? (
          <Button type="button" variant="outline" onClick={() => void c.post({ step: "connect_calls" })}>
            Review forwarding
          </Button>
        ) : null}
      </div>
      <OpusVerificationTimeline
        title="Live test progress"
        passed={c.data?.liveTest.passed}
        passedTitle="Your missed-call recovery is working"
        waitingHint="Checkpoints update automatically."
        steps={[
          { id: "call", label: "Forwarded call received", done: Boolean(c.data?.liveTest.checks.callDetected) },
          { id: "missed", label: "Missed call classified", done: Boolean(c.data?.liveTest.checks.missedCall) },
          { id: "consent", label: "Consent handled", done: Boolean(c.data?.liveTest.checks.consentCompleted) },
          { id: "sms", label: "Recovery SMS", done: Boolean(c.data?.liveTest.checks.textSent) },
          { id: "reply", label: "Caller reply received", done: Boolean(c.data?.liveTest.checks.replyReceived) },
        ]}
      />
      <aside className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Recovery flow</p>
        <p className="mt-2 text-muted-foreground">
          Customer calls → Business rings {c.forwardRingSeconds}s → Forwards to Transovo →{" "}
          {c.consentMode === "press_1" ? "Press 1 consent" : "Existing consent"} → Recovery text / Voicemail
        </p>
      </aside>
      <StepFooter
        c={c}
        back
        primary={{
          label: c.data?.liveTest.passed ? "Finish setup" : "Continue",
          onClick: async () => {
            if (c.data?.liveTest.passed) {
              await c.post({ action: "activate_trial", step: "ready" });
            } else {
              await c.post({ step: "ready" });
            }
          },
        }}
      />
    </Panel>
  );
}

export function MctbOnboardingOpusView({ controller: c }: { controller: MctbOnboardingController }) {
  const recoveryBundle = useOnboardingRecoveryBundle();
  const selectedCarrier = c.data?.carriers.find((x) => x.id === c.carrier);

  if (c.step === "ready") {
    const messagingPending = !c.tfvApproved;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="mb-6 text-sm font-semibold">Transovo · Missed Call Text Back</p>
        <Panel>
          <EmptyState
            icon={CheckCircle2}
            title="You're ready"
            description={
              messagingPending
                ? "Call handling is ready. Messaging verification is still pending — automatic recovery texts will send when approved."
                : "Your missed-call recovery setup is complete."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (c.presentation === "modal" && c.onFinished) c.onFinished();
                    else c.router.push(MCTB_ROUTES.home);
                  }}
                >
                  Go to MCTB
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href={MCTB_ROUTES.setup}>Review setup</Link>
                </Button>
              </div>
            }
          />
          {c.data?.trial?.daysRemaining != null ? (
            <p className="pb-6 text-center text-sm font-medium">Trial active · {c.data.trial.daysRemaining} days remaining</p>
          ) : null}
        </Panel>
      </div>
    );
  }

  const platformSender = Boolean(c.capabilities?.platformSenderActive);
  const platformTemplates = listMctbPlatformRecoveryOpenerChoices();
  const rootClass =
    c.presentation === "modal" ? "mx-auto w-full max-w-3xl px-4 py-4" : "mx-auto w-full max-w-3xl px-4 py-8";

  return (
    <div className={rootClass}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <p className="text-sm font-semibold">Transovo · Missed Call Text Back</p>
        <div className="flex flex-wrap items-center gap-2">
          <a className="text-sm text-primary hover:underline" href="https://help.transovo.com" target="_blank" rel="noreferrer">
            Need help?
          </a>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (c.presentation === "modal" && c.onFinished) c.onFinished();
              else c.router.push(MCTB_ROUTES.setup);
            }}
          >
            Save &amp; exit
          </Button>
        </div>
      </header>

      <OpusProgress currentIndex={Math.min(c.stageIndex, MCTB_WIZARD_PRIMARY_STEPS.length - 1)} />

      {c.error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {c.error}
        </p>
      ) : null}

      {c.step === "business_line" ? (
        <Panel title="Set up your business line" description="Start with the number your customers already call.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="onb-biz-name">Business name</Label>
              <Input id="onb-biz-name" value={c.businessName} onChange={(e) => c.setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onb-biz-phone">Business phone</Label>
              <Input id="onb-biz-phone" type="tel" value={c.businessNumber} onChange={(e) => c.setBusinessNumber(e.target.value)} placeholder="(571) 555-0188" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onb-carrier">Carrier</Label>
              <Select value={c.carrier} onValueChange={(v) => c.setCarrier(v as MctbForwardingCarrier)}>
                <SelectTrigger id="onb-carrier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(c.data?.carriers ?? []).map((car) => (
                    <SelectItem key={car.id} value={car.id}>{car.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="onb-site">Website (optional)</Label>
              <Input id="onb-site" value={c.websiteUrl} onChange={(e) => c.setWebsiteUrl(e.target.value)} />
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Transovo only receives unanswered calls — no porting required.</p>
          <div className="mt-6 space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="font-medium">Three numbers to know</p>
            <Rows
              items={[
                {
                  label: "Your business number",
                  value: c.businessNumber ? formatMctbPhoneLabel(c.businessNumber) : "Add above",
                },
                {
                  label: "Your Transovo forwarding number",
                  value: c.forwardDisplay || "Provisioning…",
                },
                {
                  label: "Text-back sender",
                  value: c.senderPresentation?.title ?? "Transovo Platform",
                },
              ]}
            />
            <p className="text-xs text-muted-foreground">
              {c.senderPresentation?.description ??
                "Unanswered calls forward to Transovo. Recovery texts use the platform sender on Free."}
            </p>
          </div>
          <StepFooter
            c={c}
            primary={{
              label: "Continue",
              disabled: !c.businessName.trim() || !c.businessNumber.trim(),
              onClick: () =>
                void c.post({
                  businessName: c.businessName.trim(),
                  websiteUrl: c.websiteUrl.trim(),
                  businessNumberE164: c.businessNumber.trim(),
                  forwardingCarrier: c.carrier,
                }),
            }}
          />
        </Panel>
      ) : null}

      {c.step === "connect_calls" ? (
        <Panel title="Connect calls" description={`Forward unanswered calls to ${c.forwardDisplay}.`}>
          {!c.data?.trialNumber.provisioned ? (
            <p className="text-sm text-muted-foreground">Assigning your MCTB number…</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Business line</Label>
                  <Input value={c.businessNumber} onChange={(e) => c.setBusinessNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Ring seconds before forward</Label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={c.forwardRingSeconds}
                    onChange={(e) => c.setForwardRingSeconds(Number(e.target.value) || 15)}
                  />
                </div>
              </div>
              <Rows
                items={[
                  { label: "Forwarding destination", value: <span className="font-mono text-xs">{c.forwardDisplay}</span> },
                  {
                    label: "Verification",
                    value: (
                      <Pill tone={c.data?.forwardingVerification?.verified ? "success" : "warning"}>
                        {c.data?.forwardingVerification?.verified ? "Verified" : "Not verified"}
                      </Pill>
                    ),
                  },
                ]}
              />
              {selectedCarrier ? (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">{selectedCarrier.label} forwarding</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                    {selectedCarrier.steps.slice(0, 6).map((s, i) => (
                      <li key={i}>{formatCarrierStep(s, c.forwardE164 ?? "")}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          )}
          <StepFooter
            c={c}
            back
            primary={{
              label: c.data?.forwardingVerification?.verified ? "Continue" : "Save & verify later",
              disabled: !c.businessNumber.trim(),
              onClick: () => {
                void (async () => {
                  await c.post({
                    forwardingCarrier: c.carrier,
                    businessNumberE164: c.businessNumber,
                    forwardingRingSeconds: c.forwardRingSeconds,
                  });
                  if (!c.data?.forwardingVerification?.verified) {
                    c.setForwardingTestActive(true);
                    await fetch("/api/mctb/onboarding", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "start_forwarding_test" }),
                    });
                    await c.load();
                    return;
                  }
                  await c.post({ step: "consent" });
                })();
              },
            }}
          />
        </Panel>
      ) : null}

      {c.step === "consent" ? (
        <Panel title="How should callers give permission to text?" description="Choose how consent is established before recovery texting.">
          {!c.existingConsentEligible ? (
            <p className="mb-3 text-xs text-muted-foreground">{existingConsentIneligibleReason(false)}</p>
          ) : null}
          <div className="space-y-3">
            {[
              {
                id: "press_1" as const,
                title: "Ask callers to press 1",
                sub: "Available on your current plan",
                icon: ShieldCheck,
              },
              {
                id: "existing_consent" as const,
                title: "I already have consent",
                sub: c.existingConsentEligible ? "Attestation required" : "Available with Recovery",
                icon: FileCheck,
              },
            ].map((opt) => {
              const selected = c.consentMode === opt.id;
              const disabled = opt.id === "existing_consent" && !c.existingConsentEligible;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => c.setConsentMode(opt.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition",
                    selected ? "border-primary ring-1 ring-primary/30" : "hover:border-muted-foreground/30",
                    disabled && "opacity-60",
                  )}
                >
                  {disabled ? (
                    <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  ) : (
                    <opt.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  <div>
                    <p className="text-sm font-medium">{opt.title}</p>
                    <p className="text-xs text-muted-foreground">{opt.sub}</p>
                  </div>
                  {opt.id === "press_1" ? (
                    <span className="ml-auto">
                      <Pill tone="primary" dot={false}>Included</Pill>
                    </span>
                  ) : disabled ? (
                    <span className="ml-auto text-xs text-muted-foreground">Locked</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {c.consentMode === "existing_consent" ? (
            <label className="mt-4 flex items-start gap-2 text-sm">
              <Checkbox checked={c.existingConsentAttested} onCheckedChange={(v) => c.setExistingConsentAttested(Boolean(v))} />
              <span>I confirm my business already has permission to text these callers.</span>
            </label>
          ) : null}
          <StepFooter
            c={c}
            back
            primary={{
              label: "Continue",
              disabled: c.consentMode === "existing_consent" && !c.existingConsentAttested,
              onClick: () =>
                void c.post({
                  consentMode: c.consentMode,
                  existingConsentAttested: c.consentMode === "existing_consent" ? true : undefined,
                }),
            }}
          />
        </Panel>
      ) : null}

      {c.step === "recovery" ? (
        <Panel title="Missed-call text" description="What callers receive after consent is established.">
          {platformSender ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Transovo Platform sender uses approved templates — you cannot type arbitrary recovery text.
              </p>
              {platformTemplates.length > 1 ? (
                <div className="space-y-2">
                  {platformTemplates.map((tpl) => (
                    <label
                      key={tpl.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3",
                        c.messageTemplate === tpl.body ? "border-primary ring-1 ring-primary/30" : "",
                      )}
                    >
                      <input
                        type="radio"
                        name="platform-template"
                        className="mt-1"
                        checked={c.messageTemplate === tpl.body}
                        onChange={() => c.setMessageTemplate(tpl.body)}
                      />
                      <span className="text-sm">{tpl.label}</span>
                    </label>
                  ))}
                </div>
              ) : null}
              <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {platformTemplates[0]?.body ?? c.messageTemplate}
              </p>
            </div>
          ) : (
            <>
              <FieldRow label="Recovery goal" description="Shapes the default opener template.">
                <Select
                  value={c.recoveryGoal}
                  onValueChange={(v) => {
                    const id = v as MctbRecoveryGoalId;
                    c.setRecoveryGoal(id);
                    c.setMessageTemplate(getRecoveryGoalDefinition(id).defaultOpener);
                  }}
                >
                  <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["get_reply", "book_appointment", "capture_lead"] as MctbRecoveryGoalId[]).map((id) => (
                      <SelectItem key={id} value={id}>{getRecoveryGoalDefinition(id).label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="onb-opener">Recovery opener</Label>
                <Textarea
                  id="onb-opener"
                  value={c.messageTemplate}
                  onChange={(e) => c.setMessageTemplate(e.target.value)}
                  rows={4}
                />
              </div>
            </>
          )}
          {c.consentMode === "press_1" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Press-1 callers receive the locked compliance confirmation before your recovery opener.
            </p>
          ) : null}
          <div className="mt-4 rounded-lg border p-4">
            <p className="text-sm font-medium">Text-back sender</p>
            <p className="mt-1 text-sm font-medium">{c.senderPresentation?.title ?? "Transovo Platform"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {platformSender
                ? "Approved Transovo templates"
                : `Number: ${c.data?.trialNumber.display || c.forwardDisplay}`}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Status: {c.tfvApproved ? "Ready" : c.data?.trialNumber.tfvStatusLabel || "Verification pending"}
            </p>
            {!c.tfvApproved ? (
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => c.setDrawerMode("verify")}>
                Complete messaging verification
              </Button>
            ) : null}
          </div>
          <OnboardingRecoveryControlsSection wiring={recoveryBundle.r} />
          <StepFooter
            c={c}
            back
            primary={{
              label: "Continue",
              disabled: !c.messageTemplate.trim(),
              onClick: () =>
                void (async () => {
                  await recoveryBundle.saveAll(c.messageTemplate.trim());
                  await c.post({
                    ...(platformSender ? {} : { recoveryGoal: c.recoveryGoal }),
                    messageTemplate: c.messageTemplate.trim(),
                  });
                })(),
            }}
          />
        </Panel>
      ) : null}

      {c.step === "notifications" ? (
        <OnboardingNotificationsStep c={c} caps={c.capabilities} />
      ) : null}

      {c.step === "voicemail" ? (
        <OnboardingVoicemailStep c={c} />
      ) : null}

      {c.step === "review_test" ? (
        <ReviewTestOpusStep c={c} />
      ) : null}

      <MctbNumberDrawerOpus
        open={c.drawerMode}
        onClose={() => c.setDrawerMode(null)}
        onOpenMode={c.setDrawerMode}
        onNumbersChanged={() => void c.load()}
      />
    </div>
  );
}
