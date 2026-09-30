"use client";

import { MctbOnboardingProgress } from "@/components/mctb/onboarding/mctb-onboarding-progress";
import { Button } from "@/newui-transplant/components/ui/button";
import { Panel } from "@/newui-transplant/components/app/kit";
import { MctbPhoneForwardingPanel } from "@/components/mctb/wizard/mctb-phone-forwarding-panel";
import { MctbHeroNumber } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import {
  MctbConsentModeCards,
  MctbMessagingActivationPanel,
  MctbVerificationTimeline,
} from "@/components/mctb/wizard/mctb-wizard-ui";
import type { CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import type {
  MctbConsentMode,
  MctbForwardingCarrier,
  MctbOnboardingState,
  MctbOnboardingStep,
  MctbTfvStatus,
} from "@/lib/mctb/onboarding/types";
import {
  normalizeOnboardingStep,
  wizardStageIndex,
} from "@/lib/mctb/onboarding/wizard-flow";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { formatMctbPhoneLabel } from "@/lib/mctb/phone-display";
import { existingConsentIneligibleReason } from "@/lib/mctb/setup-consent-eligibility";
import { CheckCircle2, FileCheck, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MctbNumberDrawerHost,
  useMctbNumberDrawerEvents,
  type MctbNumberDrawerMode,
} from "@/components/mctb/numbers/mctb-number-drawer-host";
import { MctbRecoveryGoalSetupSection } from "@/components/mctb/setup/mctb-recovery-goal-setup-section";
import { OnboardingVoicemailStep } from "@/components/mctb/onboarding/onboarding-voicemail-step";
import {
  getRecoveryGoalDefinition,
  type MctbRecoveryGoalId,
} from "@/lib/mctb/recovery-goals";
import { MCTB_LAUNCH_TRY_IT_ENABLED } from "@/lib/mctb/launch-flags";
import {
  MctbOnboardingOpusView,
  type MctbOnboardingController,
} from "@/newui-transplant/connected/mctb/mctb-onboarding-opus-view";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";

type OnboardingPayload = {
  state: MctbOnboardingState;
  trialNumber: {
    provisioned: boolean;
    phoneNumberId?: string | null;
    display: string | null;
    messagingVerificationStatus: MctbTfvStatus;
    tfvStatusLabel: string;
    messagingApproved?: boolean;
    numberClass?: string | null;
  };
  liveTest: {
    started: boolean;
    passed: boolean;
    checks: Record<string, boolean>;
    forwardTargetE164: string | null;
    businessNumberE164: string | null;
  };
  tfv: {
    status: string;
    approved: boolean;
    failureReason?: string | null;
    messagingApproved?: boolean;
    numberClass?: string | null;
  };
  demo: {
    demoNumberDisplay: string | null;
    demoNumberE164: string;
    description?: string;
    label?: string;
    checks: Record<string, boolean>;
    completed: boolean;
  };
  carriers: CarrierForwardingGuide[];
  forwardingVerification: {
    testStarted: boolean;
    verified: boolean;
    path: string | null;
  } | null;
  forwardTargetE164?: string | null;
  productionForwardE164?: string | null;
  trial?: { daysRemaining?: number; active?: boolean };
  capabilities?: MctbCapabilities;
  senderPresentation?: { title: string; description: string };
};

const DEFAULT_MESSAGE =
  "Sorry we missed your call! Reply here and we'll get back to you shortly.";

type Props = {
  initialBusinessName?: string;
  shell?: "legacy" | "opus";
  presentation?: "page" | "modal";
  onFinished?: () => void;
};

export function MctbOnboardingRuntime({
  initialBusinessName = "",
  shell = "legacy",
  presentation = "page",
  onFinished,
}: Props) {
  const opus = shell === "opus";
  const router = useRouter();
  const [data, setData] = useState<OnboardingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingConsentEligible, setExistingConsentEligible] = useState(false);

  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [carrier, setCarrier] = useState<MctbForwardingCarrier>("verizon");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE);
  const [recoveryGoal, setRecoveryGoal] = useState<MctbRecoveryGoalId>("get_reply");
  const [consentMode, setConsentMode] = useState<MctbConsentMode>("press_1");
  const [existingConsentAttested, setExistingConsentAttested] = useState(false);
  const [forwardRingSeconds, setForwardRingSeconds] = useState(15);
  const [forwardingTestActive, setForwardingTestActive] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<MctbNumberDrawerMode>(null);
  useMctbNumberDrawerEvents(setDrawerMode);

  useEffect(() => {
    if (!opus) {
      void import("@/lib/mctb/onboarding/mctb-onboarding-legacy-styles");
    }
  }, [opus]);

  const step = normalizeOnboardingStep(data?.state.currentStep || "business_line");
  const stageIndex = wizardStageIndex(step);

  const load = useCallback(async () => {
    const [onbRes, setupRes] = await Promise.all([
      fetch("/api/mctb/onboarding", { cache: "no-store" }),
      fetch("/api/mctb/setup", { cache: "no-store" }).catch(() => null),
    ]);
    const json = (await onbRes.json()) as OnboardingPayload;
    if (json.state) {
      setData(json);
      if (json.state.businessName) setBusinessName(json.state.businessName);
      if (json.state.websiteUrl) setWebsiteUrl(json.state.websiteUrl);
      if (json.state.messageTemplate) setMessageTemplate(json.state.messageTemplate);
      if (json.state.consentMode) setConsentMode(json.state.consentMode);
      if (json.state.forwardingCarrier) setCarrier(json.state.forwardingCarrier);
      if (json.state.businessNumberE164) setBusinessNumber(json.state.businessNumberE164);
      if (json.state.forwardingRingSeconds) setForwardRingSeconds(json.state.forwardingRingSeconds);
      if (json.forwardingVerification?.verified) setForwardingTestActive(false);
    }
    if (setupRes?.ok) {
      const setupJson = (await setupRes.json()) as {
        data?: { consentMeta?: { existingConsentEligible?: boolean } };
        consentMeta?: { existingConsentEligible?: boolean };
      };
      const ready = Boolean(
        setupJson?.data?.consentMeta?.existingConsentEligible ??
          setupJson?.consentMeta?.existingConsentEligible,
      );
      setExistingConsentEligible(ready);
    } else if (json.capabilities) {
      setExistingConsentEligible(Boolean(json.capabilities.pressOneConsent));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (step !== "business_line" && step !== "connect_calls") return;
    if (data?.trialNumber.provisioned) return;
    void provisionTrialNumber();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- provision idempotently when wizard opens business/connect
  }, [step, data?.trialNumber.provisioned]);

  useEffect(() => {
    if (step !== "connect_calls" && step !== "review_test") return;
    if (!forwardingTestActive && !data?.state.forwardingTestStartedAt) return;
    if (data?.forwardingVerification?.verified) return;
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [step, forwardingTestActive, data, load]);

  useEffect(() => {
    if (step !== "review_test") return;
    void fetch("/api/mctb/live-test", { method: "POST" }).catch(() => undefined);
    const timer = setInterval(() => {
      void fetch("/api/mctb/live-test", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (!j.data) return;
          setData((prev) => (prev ? { ...prev, liveTest: j.data } : prev));
          if (j.data.passed) void load();
        });
    }, 3000);
    return () => clearInterval(timer);
  }, [step, load]);

  useEffect(() => {
    if (step !== "recovery") return;
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [step, load]);

  useEffect(() => {
    if (!demoOpen) return;
    const timer = setInterval(() => void load(), 2500);
    return () => clearInterval(timer);
  }, [demoOpen, load]);

  async function post(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      await load();
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      return null;
    } finally {
      setSaving(false);
    }
  }

  const provisionTrialNumber = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "provision_trial_number" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not assign number");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign number");
    } finally {
      setSaving(false);
    }
  }, [load]);

  const forwardE164 =
    data?.productionForwardE164 || data?.forwardTargetE164 || data?.liveTest.forwardTargetE164;
  const forwardDisplay = forwardE164 ? formatMctbPhoneLabel(forwardE164) : "your MCTB number";
  const tfvApproved =
    data?.capabilities?.platformSenderActive ||
    data?.tfv.approved ||
    data?.trialNumber.messagingApproved === true;
  const usesA2pPath = data?.tfv.numberClass === "TELNYX_LOCAL_A2P";

  const previousStep = useMemo((): MctbOnboardingStep | null => {
    const order: MctbOnboardingStep[] = [
      "business_line",
      "consent",
      "recovery",
      "voicemail",
      "notifications",
      "connect_calls",
      "review_test",
    ];
    const idx = order.indexOf(step);
    return idx > 0 ? order[idx - 1]! : null;
  }, [step]);

  async function startDemo() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_demo",
          consentMode,
          existingConsentAttested:
            consentMode === "existing_consent" ? existingConsentAttested : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not start demo");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo unavailable");
    } finally {
      setSaving(false);
    }
  }

  function panelFooter(back?: boolean, primary?: { label: string; onClick: () => void; disabled?: boolean }) {
    if (opus) {
      return (
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            {back && previousStep ? (
              <Button type="button" variant="outline" disabled={saving} onClick={() => void post({ step: previousStep })}>
                Back
              </Button>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">{saving ? "Saving…" : null}</span>
          {primary ? (
            <Button type="button" disabled={saving || primary.disabled} onClick={primary.onClick}>
              {primary.label}
            </Button>
          ) : null}
        </footer>
      );
    }
    return (
      <footer className="mctb-onb-footer">
        <div>
          {back && previousStep ? (
            <button
              type="button"
              className="mctb-setup-btn mctb-setup-btn--outline"
              disabled={saving}
              onClick={() => void post({ step: previousStep })}
            >
              Back
            </button>
          ) : (
            <span />
          )}
        </div>
        <span className="mctb-onb-footer__status">{saving ? "Saving…" : null}</span>
        {primary ? (
          <button
            type="button"
            className="mctb-setup-btn mctb-setup-btn--primary"
            disabled={saving || primary.disabled}
            onClick={primary.onClick}
          >
            {primary.label}
          </button>
        ) : null}
      </footer>
    );
  }

  if (loading) {
    if (opus) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading setup…
        </div>
      );
    }
    return (
      <div className="mctb-onb-root flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3a3f47]" aria-label="Loading" />
      </div>
    );
  }

  if (opus) {
    const controller: MctbOnboardingController = {
      data,
      saving,
      error,
      setError,
      existingConsentEligible,
      businessName,
      setBusinessName,
      websiteUrl,
      setWebsiteUrl,
      businessNumber,
      setBusinessNumber,
      carrier,
      setCarrier,
      messageTemplate,
      setMessageTemplate,
      recoveryGoal,
      setRecoveryGoal,
      consentMode,
      setConsentMode,
      existingConsentAttested,
      setExistingConsentAttested,
      forwardRingSeconds,
      setForwardRingSeconds,
      setForwardingTestActive,
      drawerMode,
      setDrawerMode,
      step,
      stageIndex,
      load,
      post,
      previousStep,
      forwardE164,
      forwardDisplay,
      tfvApproved,
      usesA2pPath,
      router,
      presentation,
      onFinished,
      capabilities: data?.capabilities ?? null,
      senderPresentation: data?.senderPresentation ?? null,
    };
    return <MctbOnboardingOpusView controller={controller} />;
  }

  if (step === "ready") {
    const messagingPending = !tfvApproved;
    const readyBody = (
      <div className="px-2 py-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">You&apos;re ready</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {messagingPending
            ? "Call handling is ready. Messaging verification is still pending — automatic recovery texts will send when approved."
            : "Your missed-call recovery setup is complete."}
        </p>
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Free plan · 10 recoveries per month on the Transovo platform sender
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => router.push(MCTB_ROUTES.home)}>Go to MCTB</Button>
          <Button type="button" variant="outline" asChild>
            <Link href={MCTB_ROUTES.setup}>Review setup</Link>
          </Button>
        </div>
      </div>
    );
    if (opus) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="mb-6 text-sm font-semibold">Transovo · Missed Call Text Back</p>
          <Panel>{readyBody}</Panel>
        </div>
      );
    }
    return (
      <div className="mctb-onb-root">
        <header className="mctb-onb-top">
          <div className="mctb-onb-top__brand">
            <span className="mctb-onb-top__logo">Transovo</span>
            <span className="mctb-onb-top__product">Missed Call Text Back</span>
          </div>
        </header>
        <main className="mctb-onb-main">
          <div className="mctb-onb-panel text-center">{readyBody}</div>
        </main>
      </div>
    );
  }

  const topChrome = opus ? (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <p className="text-sm font-semibold">Transovo · Missed Call Text Back</p>
      <div className="flex flex-wrap items-center gap-2">
        <a className="text-sm text-primary hover:underline" href="https://help.transovo.com" target="_blank" rel="noreferrer">
          Need help?
        </a>
        <Button type="button" variant="outline" onClick={() => router.push(MCTB_ROUTES.setup)}>
          Save &amp; exit
        </Button>
      </div>
    </header>
  ) : (
    <header className="mctb-onb-top">
      <div className="mctb-onb-top__brand">
        <span className="mctb-onb-top__logo">Transovo</span>
        <span className="mctb-onb-top__product">Missed Call Text Back</span>
      </div>
      <div className="mctb-onb-top__actions">
        <a className="mctb-onb-top__link" href="https://help.transovo.com" target="_blank" rel="noreferrer">
          Need help?
        </a>
        <button
          type="button"
          className="mctb-setup-btn mctb-setup-btn--outline"
          onClick={() => router.push(MCTB_ROUTES.setup)}
        >
          Save & exit
        </button>
      </div>
    </header>
  );

  return (
    <div className={opus ? "mx-auto w-full max-w-3xl px-4 py-8" : "mctb-onb-root"}>
      {topChrome}

      <main className={opus ? "min-w-0" : "mctb-onb-main"}>
        <MctbOnboardingProgress currentIndex={Math.min(stageIndex, 5)} />

        {error ? <div className="mctb-onb-error" role="alert">{error}</div> : null}

        {step === "business_line" ? (
          <div className="mctb-onb-panel">
            <header className="mctb-onb-panel__head">
              <h1 className="mctb-onb-panel__title">Set up your business line</h1>
              <p className="mctb-onb-panel__sub">Start with the number your customers already call.</p>
            </header>
            <div className="mctb-onb-panel__body mctb-onb-split">
              <div>
                <div className="mctb-onb-field">
                  <label htmlFor="mctb-onb-biz-name">Business name</label>
                  <input
                    id="mctb-onb-biz-name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="mctb-onb-field">
                  <label htmlFor="mctb-onb-biz-phone">Business phone</label>
                  <input
                    id="mctb-onb-biz-phone"
                    type="tel"
                    value={businessNumber}
                    onChange={(e) => setBusinessNumber(e.target.value)}
                    placeholder="(571) 555-0188"
                  />
                </div>
                <div className="mctb-onb-field">
                  <label htmlFor="mctb-onb-carrier">Carrier / provider</label>
                  <select
                    id="mctb-onb-carrier"
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value as MctbForwardingCarrier)}
                  >
                    {(data?.carriers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mctb-onb-field">
                  <label htmlFor="mctb-onb-site">Website (optional)</label>
                  <input
                    id="mctb-onb-site"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                  />
                </div>
              </div>
              <aside className="mctb-onb-aside">
                <h2 className="mctb-onb-aside__title">Keep your existing number</h2>
                <div className="mctb-onb-flow">
                  <span className="mctb-onb-flow__node">Customers</span>
                  <span aria-hidden>↓</span>
                  <span className="mctb-onb-flow__node">
                    Your business number
                    <br />
                    {businessNumber ? formatMctbPhoneLabel(businessNumber) : "(your line)"}
                  </span>
                  <span aria-hidden>↓</span>
                  <span className="mctb-onb-flow__node text-[12px] text-[#626872]">
                    Transovo only receives unanswered calls
                  </span>
                </div>
                <p className="mt-3 text-[12px] text-[#626872]">No porting required.</p>
                <button
                  type="button"
                  className="mt-3 text-[12px] font-semibold text-[#3a3f47] underline"
                  onClick={() => setDemoOpen(true)}
                  hidden={!MCTB_LAUNCH_TRY_IT_ENABLED}
                >
                  See how it works
                </button>
              </aside>
            </div>
            {panelFooter(false, {
              label: "Continue",
              disabled: !businessName.trim() || !businessNumber.trim(),
              onClick: () =>
                void post({
                  businessName: businessName.trim(),
                  websiteUrl: websiteUrl.trim(),
                  businessNumberE164: businessNumber.trim(),
                  forwardingCarrier: carrier,
                }),
            })}
          </div>
        ) : null}

        {step === "connect_calls" ? (
          <div className="mctb-onb-panel">
            <header className="mctb-onb-panel__head">
              <h1 className="mctb-onb-panel__title">Connect calls</h1>
              <p className="mctb-onb-panel__sub">
                Forward unanswered calls from your business line to {forwardDisplay}.
              </p>
            </header>
            <div className="mctb-onb-panel__body">
              {!data?.trialNumber.provisioned ? (
                <p className="text-[13px] text-[#626872]">Assigning your MCTB number…</p>
              ) : (
                <MctbPhoneForwardingPanel
                  businessNumber={businessNumber}
                  onBusinessNumberChange={setBusinessNumber}
                  carrier={carrier}
                  onCarrierChange={setCarrier}
                  carriers={data?.carriers ?? []}
                  forwardDisplay={forwardDisplay}
                  forwardE164={forwardE164}
                  forwardRingSeconds={forwardRingSeconds}
                  onForwardRingSecondsChange={setForwardRingSeconds}
                  verification={data?.forwardingVerification ?? null}
                  connectionStatus={
                    data?.forwardingVerification?.verified
                      ? "ready"
                      : data?.forwardingVerification?.testStarted
                        ? "pending"
                        : "unknown"
                  }
                />
              )}
            </div>
            {panelFooter(true, {
              label: data?.forwardingVerification?.verified ? "Continue" : "Save & verify later",
              disabled: !businessNumber.trim(),
              onClick: async () => {
                await post({
                  forwardingCarrier: carrier,
                  businessNumberE164: businessNumber,
                  forwardingRingSeconds: forwardRingSeconds,
                });
                if (!data?.forwardingVerification?.verified) {
                  setForwardingTestActive(true);
                  await fetch("/api/mctb/onboarding", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "start_forwarding_test" }),
                  });
                  await load();
                  return;
                }
                await post({ step: "consent" });
              },
            })}
          </div>
        ) : null}

        {step === "consent" ? (
          <div className="mctb-onb-panel">
            <header className="mctb-onb-panel__head">
              <h1 className="mctb-onb-panel__title">How should callers give permission to text?</h1>
              <p className="mctb-onb-panel__sub">
                Choose how consent is established before automatic recovery texting.
              </p>
            </header>
            <div className="mctb-onb-panel__body">
              {!existingConsentEligible ? (
                <p className="mb-3 text-[12.5px] text-[#626872]">
                  {existingConsentIneligibleReason(
                    false,
                    Boolean(data?.capabilities?.platformSenderActive),
                    Boolean(data?.capabilities?.pressOneConsent),
                  )}
                </p>
              ) : null}
              <MctbConsentModeCards
                value={consentMode}
                onChange={(mode) => {
                  if (mode === "existing_consent" && !existingConsentEligible) return;
                  setConsentMode(mode);
                }}
                attested={existingConsentAttested}
                onAttestedChange={setExistingConsentAttested}
                options={[
                  {
                    id: "press_1",
                    title: "Ask callers to press 1",
                    subtitle: "Transovo plays a short disclosure and records permission for the call.",
                    audience: "Per-call consent · Recommended",
                    badge: "Recommended",
                    icon: ShieldCheck,
                    nextSteps: ["Disclosure", "Press 1", "Consent recorded", "Recovery eligible"],
                  },
                  {
                    id: "existing_consent",
                    title: "Use permission my business already has",
                    subtitle: "For businesses that already have valid permission to text customers.",
                    audience: "Existing-consent mode",
                    icon: FileCheck,
                    nextSteps: ["Missed call", "Existing permission", "Recovery eligibility"],
                  },
                ]}
              />
            </div>
            {panelFooter(true, {
              label: "Continue",
              disabled: consentMode === "existing_consent" && !existingConsentAttested,
              onClick: () =>
                void post({
                  consentMode,
                  existingConsentAttested:
                    consentMode === "existing_consent" ? true : undefined,
                }),
            })}
          </div>
        ) : null}

        {step === "recovery" ? (
          <div className="mctb-onb-panel">
            <header className="mctb-onb-panel__head">
              <h1 className="mctb-onb-panel__title">Recovery message & texting</h1>
              <p className="mctb-onb-panel__sub">
                Configure the first recovery text and messaging readiness for {forwardDisplay}.
              </p>
            </header>
            <div className="mctb-onb-panel__body mctb-onb-split">
              <div>
                <MctbRecoveryGoalSetupSection
                  value={recoveryGoal}
                  messagePreview={
                    messageTemplate || getRecoveryGoalDefinition(recoveryGoal).defaultOpener
                  }
                  onGoalChange={(id, suggested) => {
                    setRecoveryGoal(id);
                    setMessageTemplate(suggested);
                  }}
                  onMessageChange={setMessageTemplate}
                />
                {consentMode === "press_1" ? (
                  <p className="mt-3 text-[12px] text-[#626872]">
                    Press-1 callers also receive the locked compliance confirmation before your recovery
                    opener.
                  </p>
                ) : null}
                <div className="mt-4 rounded-lg border border-[#e8eaed] p-3 text-[13px]">
                  <p className="font-semibold">Text-back number</p>
                  <p className="mt-1 font-mono">{data?.trialNumber.display || forwardDisplay}</p>
                  <p className="mt-1 text-[#626872]">
                    Status:{" "}
                    {tfvApproved ? "Ready" : data?.trialNumber.tfvStatusLabel || "Verification pending"}
                  </p>
                  {!tfvApproved ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="mctb-setup-btn mctb-setup-btn--outline"
                        onClick={() => setDrawerMode("verify")}
                      >
                        Complete messaging verification
                      </button>
                      {!data?.trialNumber.provisioned ? (
                        <button
                          type="button"
                          className="mctb-setup-btn mctb-setup-btn--outline"
                          onClick={() => setDrawerMode("add")}
                        >
                          Choose a number
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <aside className="mctb-onb-aside">
                <MctbMessagingActivationPanel
                  statusLabel={data?.trialNumber.tfvStatusLabel || data?.tfv.status || "Not started"}
                  usesA2pPath={usesA2pPath}
                  approved={tfvApproved}
                  actionRequired={data?.trialNumber.messagingVerificationStatus === "action_required"}
                  failureReason={data?.tfv.failureReason}
                  numberDisplay={data?.trialNumber.display || forwardDisplay}
                />
              </aside>
            </div>
            {panelFooter(true, {
              label: "Continue",
              disabled: !messageTemplate.trim(),
              onClick: () =>
                void post({
                  recoveryGoal,
                  messageTemplate: messageTemplate.trim(),
                }),
            })}
          </div>
        ) : null}

        {step === "voicemail" ? (
          <div className="mctb-onb-panel">
            <header className="mctb-onb-panel__head">
              <h1 className="mctb-onb-panel__title">Set up voicemail</h1>
              <p className="mctb-onb-panel__sub">Choose what callers hear when you cannot answer.</p>
            </header>
            <div className="mctb-onb-panel__body mctb-onb-split">
              <OnboardingVoicemailStep
                phoneNumberId={data?.trialNumber.phoneNumberId ?? null}
                press1Mode={consentMode === "press_1"}
                onPlatformDefault={() => post({ action: "mark_voicemail_configured" })}
                onContinue={() => post({ action: "mark_voicemail_configured" })}
              />
            </div>
            {panelFooter(true, {
              label: "Continue",
              onClick: () => void post({ action: "mark_voicemail_configured" }),
            })}
          </div>
        ) : null}

        {step === "review_test" ? (
          <div className="mctb-onb-panel">
            <header className="mctb-onb-panel__head">
              <h1 className="mctb-onb-panel__title">Review & test</h1>
              <p className="mctb-onb-panel__sub">
                Confirm your setup, then run a live test from {businessNumber || "your business line"}.
              </p>
            </header>
            <div className="mctb-onb-panel__body mctb-onb-split">
              <div>
                <ul className="space-y-2 text-[13px]">
                  {[
                    ["Business line", businessNumber ? formatMctbPhoneLabel(businessNumber) : "—", "business_line"],
                    ["Forwarding", data?.forwardingVerification?.verified ? "Verified" : "Not verified", "connect_calls"],
                    ["Consent", consentMode === "press_1" ? "Press 1" : "Existing consent", "consent"],
                    ["Recovery message", messageTemplate ? "Configured" : "—", "recovery"],
                    ["Messaging", tfvApproved ? "Ready" : "Pending", "recovery"],
                  ].map(([label, value, jump]) => (
                    <li key={label} className="flex items-center justify-between gap-2 border-b border-[#f0f2f4] py-2">
                      <span className="text-[#626872]">{label}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{value}</span>
                        <button
                          type="button"
                          className="text-[12px] font-semibold text-[#3a3f47] underline"
                          onClick={() => void post({ step: jump })}
                        >
                          Edit
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mctb-setup-btn mctb-setup-btn--primary mt-4"
                  disabled={saving}
                  onClick={async () => {
                    await fetch("/api/mctb/live-test", { method: "POST" });
                    await load();
                  }}
                >
                  Run live test
                </button>
                {!data?.forwardingVerification?.verified ? (
                  <p className="mt-2 text-[12px] text-amber-800">
                    Forwarding wasn&apos;t verified yet.{" "}
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => void post({ step: "connect_calls" })}
                    >
                      Review forwarding
                    </button>
                  </p>
                ) : null}
                <MctbVerificationTimeline
                  title="Live test progress"
                  passed={data?.liveTest.passed}
                  passedTitle="Your missed-call recovery is working"
                  waitingHint="Checkpoints update automatically."
                  steps={[
                    { id: "call", label: "Forwarded call received", done: data?.liveTest.checks.callDetected || false },
                    { id: "missed", label: "Missed call classified", done: data?.liveTest.checks.missedCall || false },
                    { id: "consent", label: "Consent handled", done: data?.liveTest.checks.consentCompleted || false },
                    { id: "sms", label: "Recovery SMS", done: data?.liveTest.checks.textSent || false },
                  ]}
                />
              </div>
              <aside className="mctb-onb-aside">
                <h2 className="mctb-onb-aside__title">Recovery flow</h2>
                <div className="mctb-onb-flow text-left items-start">
                  <span>Customer calls → Business rings {forwardRingSeconds}s → Forwards to Transovo</span>
                  <span>→ {consentMode === "press_1" ? "Press 1 consent" : "Existing consent"} → Recovery text / Voicemail</span>
                </div>
              </aside>
            </div>
            {panelFooter(true, {
              label: data?.liveTest.passed ? "Finish setup" : "Continue",
              onClick: async () => {
                if (data?.liveTest.passed) {
                  await post({ action: "activate_trial", step: "ready" });
                } else {
                  await post({ step: "ready" });
                }
              },
            })}
          </div>
        ) : null}
      </main>

      <MctbNumberDrawerHost
        open={drawerMode}
        onClose={() => setDrawerMode(null)}
        onOpenMode={setDrawerMode}
        onNumbersChanged={() => void load()}
      />

      {demoOpen ? (
        <div className="mctb-onb-modal-backdrop" role="presentation" onClick={() => setDemoOpen(false)}>
          <div className="mctb-onb-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">How missed-call recovery works</h2>
            <p className="mt-1 text-[13px] text-[#626872]">{data?.demo.description}</p>
            <MctbHeroNumber
              label={data?.demo.label || "Demo number"}
              number={data?.demo.demoNumberDisplay || "—"}
              hint="Call from your verified mobile without forwarding."
              tint="blue"
            />
            <button
              type="button"
              className="mctb-setup-btn mctb-setup-btn--primary mt-3"
              disabled={saving}
              onClick={() => void startDemo()}
            >
              Start demo call
            </button>
            <MctbVerificationTimeline
              title="Demo progress"
              passed={data?.demo.completed}
              passedTitle="Demo complete"
              steps={[
                { id: "c", label: "Call detected", done: data?.demo.checks.callDetected || false },
                { id: "t", label: "Text delivered", done: data?.demo.checks.textDelivered || false },
              ]}
            />
            <button type="button" className="mctb-setup-btn mctb-setup-btn--outline mt-3" onClick={() => setDemoOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
