"use client";

import { Button } from "@/components/ui/button";
import type { CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import type {
  MctbConsentMode,
  MctbForwardingCarrier,
  MctbOnboardingState,
  MctbOnboardingStep,
  MctbTfvStatus,
} from "@/lib/mctb/onboarding/types";
import {
  Building2,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Phone,
  PhoneMissed,
  ShieldCheck,
  Sparkles,
  Zap,
  FileCheck,
} from "lucide-react";
import Link from "next/link";
import {
  MctbCallout,
  MctbHeroNumber,
} from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import { MctbPhoneForwardingPanel } from "@/components/mctb/wizard/mctb-phone-forwarding-panel";
import {
  MctbBusinessIdentityStep,
  MctbConsentModeCards,
  MctbConnectionStatusCard,
  MctbFlowStepper,
  MctbMessagingActivationPanel,
  MctbTextBackComposer,
  MctbVerificationTimeline,
} from "@/components/mctb/wizard/mctb-wizard-ui";
import { MctbWizardStepShell } from "@/components/mctb/setup/wizard-step-shell";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./kimi-ui/reference.css";

type OnboardingPayload = {
  state: MctbOnboardingState;
  steps: MctbOnboardingStep[];
  stepLabels: Record<MctbOnboardingStep, string>;
  demo: {
    demoNumberE164: string;
    demoNumberDisplay: string | null;
    label?: string;
    description?: string;
    consentMode?: string;
    requiresForwarding?: boolean;
    checks: {
      callDetected: boolean;
      missedCall: boolean;
      textDelivered: boolean;
      replyReceived: boolean;
    };
    completed: boolean;
  };
  trialNumber: {
    provisioned: boolean;
    display: string | null;
    voiceStatus: string | null;
    messagingVerificationStatus: MctbTfvStatus;
    tfvStatusLabel: string;
    messagingApproved?: boolean;
    numberClass?: string | null;
    complianceType?: string | null;
  };
  liveTest: {
    started: boolean;
    passed: boolean;
    checks: {
      callDetected: boolean;
      missedCall: boolean;
      consentCompleted: boolean;
      textSent: boolean;
      textDelivered: boolean;
      replyReceived: boolean;
    };
    forwardTargetE164: string | null;
    /** @deprecated use forwardTargetE164 */
    trialNumberE164?: string | null;
    businessNumberE164: string | null;
  };
  tfv: {
    status: string;
    approved: boolean;
    trialE164: string | null;
    failureReason?: string | null;
    messagingApproved?: boolean;
    numberClass?: string | null;
    complianceType?: string | null;
  };
  carriers: CarrierForwardingGuide[];
  demoIngressE164?: string | null;
  productionForwardE164?: string | null;
  forwardTargetE164?: string | null;
  defaultBusinessLineE164?: string | null;
  forwardingVerification: {
    testStarted: boolean;
    callDetected: boolean;
    verified: boolean;
    path: string | null;
    aniLikelyPreserved: boolean | null;
  } | null;
};

const DEFAULT_MESSAGE =
  "Sorry we missed your call! Reply here and we'll get back to you shortly.";

type Props = {
  initialBusinessName?: string;
};

export function MctbOnboardingWizard({ initialBusinessName = "" }: Props) {
  const router = useRouter();
  const [data, setData] = useState<OnboardingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE);
  const [consentMode, setConsentMode] = useState<MctbConsentMode>("press_1");
  const [existingConsentAttested, setExistingConsentAttested] = useState(false);
  const [carrier, setCarrier] = useState<MctbForwardingCarrier>("verizon");
  const [forwardRingSeconds, setForwardRingSeconds] = useState(15);
  const [forwardingTestActive, setForwardingTestActive] = useState(false);
  const [businessNumber, setBusinessNumber] = useState("");

  const step = data?.state.currentStep || "business";
  const stepIndex = useMemo(
    () => (data ? data.steps.indexOf(step) : 0),
    [data, step],
  );
  const previousStep = useMemo((): MctbOnboardingStep | null => {
    if (!data || stepIndex <= 0) return null;
    return data.steps[stepIndex - 1] ?? null;
  }, [data, stepIndex]);

  const load = useCallback(async () => {
    const res = await fetch("/api/mctb/onboarding", { cache: "no-store" });
    const json = (await res.json()) as OnboardingPayload;
    if (json.state) {
      setData(json);
      if (json.state.businessName) setBusinessName(json.state.businessName);
      if (json.state.websiteUrl) setWebsiteUrl(json.state.websiteUrl);
      if (json.state.messageTemplate) setMessageTemplate(json.state.messageTemplate);
      if (json.state.consentMode) setConsentMode(json.state.consentMode);
      if (json.state.forwardingCarrier) setCarrier(json.state.forwardingCarrier);
      if (json.state.businessNumberE164) setBusinessNumber(json.state.businessNumberE164);
      else if (json.defaultBusinessLineE164) setBusinessNumber(json.defaultBusinessLineE164);
      if (json.state.forwardingRingSeconds) setForwardRingSeconds(json.state.forwardingRingSeconds);
      if (json.state.forwardingTestStartedAt && !json.state.forwardingConnectedAt) {
        setForwardingTestActive(true);
      }
      if (json.forwardingVerification?.verified) setForwardingTestActive(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (step !== "demo") return;
    const timer = setInterval(() => {
      void load();
    }, 2500);
    return () => clearInterval(timer);
  }, [step, load]);

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
      if (!res.ok) throw new Error(json.error || "Could not assign production number");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign production number");
    } finally {
      setSaving(false);
    }
  }, [load]);

  useEffect(() => {
    if (step !== "connect" && step !== "live_test") return;
    if (!forwardingTestActive && !data?.state.forwardingTestStartedAt) return;
    if (data?.forwardingVerification?.verified) return;
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [
    step,
    forwardingTestActive,
    data?.state.forwardingTestStartedAt,
    data?.forwardingVerification?.verified,
    load,
  ]);

  useEffect(() => {
    if (step !== "live_test") return;
    void fetch("/api/mctb/live-test", { method: "POST" }).catch(() => undefined);
    const timer = setInterval(() => {
      void fetch("/api/mctb/live-test", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (!j.data) return;
          setData((prev) => (prev ? { ...prev, liveTest: j.data } : prev));
          if (j.data.passed) void load();
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [step, load]);

  useEffect(() => {
    if (step !== "pending" && step !== "tfv") return;
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [step, load]);

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

  const goBack = () => {
    if (previousStep) void post({ step: previousStep });
  };

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

  const trialDisplay = data?.trialNumber.display;
  const trialE164 = data?.tfv.trialE164 ?? null;
  const forwardE164 =
    data?.productionForwardE164 ||
    data?.forwardTargetE164 ||
    data?.liveTest.forwardTargetE164 ||
    null;
  const forwardDisplay = forwardE164
    ? forwardE164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "1-$1-$2-$3")
    : "your assigned MCTB number";
  const demoNumberE164 = data?.demoIngressE164 || data?.demo.demoNumberE164 || null;
  const demoNumberDisplay =
    data?.demo.demoNumberDisplay ||
    (demoNumberE164
      ? demoNumberE164.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "1-$1-$2-$3")
      : "demo line");
  const tfvApproved =
    data?.tfv.approved || data?.trialNumber.messagingApproved === true || false;
  const usesA2pPath =
    data?.tfv.numberClass === "TELNYX_LOCAL_A2P" ||
    data?.trialNumber.numberClass === "TELNYX_LOCAL_A2P";
  const tfvActionRequired = data?.trialNumber.messagingVerificationStatus === "action_required";
  const tfvFailureReason = data?.tfv.failureReason;

  if (loading) {
    return (
      <div className="mctb-page flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mctb-page voice-theme">
      <div className="mctb-page-inner max-w-4xl space-y-5">
        <div className="voice-card border-indigo-100/80 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/40 p-6 shadow-sm">
          <span className="ref-pill pill-purple">Missed Call Text Back</span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[28px]">
            Set up missed-call recovery
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-600">
            Step {stepIndex + 1} of {data?.steps.length || 10}:{" "}
            <span className="font-semibold text-gray-900">{data?.stepLabels[step]}</span>
          </p>
        </div>

        {data ? (
          <MctbFlowStepper
            steps={data.steps}
            labels={data.stepLabels}
            currentIndex={stepIndex}
          />
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

      {step === "business" ? (
        <MctbWizardStepShell
          icon={Building2}
          title="Business information"
          description="Tell us how your business should appear on missed-call recovery messages."
          onPrimary={() =>
            void post({ businessName: businessName.trim(), websiteUrl: websiteUrl.trim() })
          }
          primaryDisabled={!businessName.trim()}
          primaryLoading={saving}
        >
          <MctbBusinessIdentityStep
            businessName={businessName}
            onBusinessNameChange={setBusinessName}
            websiteUrl={websiteUrl}
            onWebsiteUrlChange={setWebsiteUrl}
          />
        </MctbWizardStepShell>
      ) : null}

      {step === "trial_number" ? (
        <MctbWizardStepShell
          icon={Phone}
          title="Your production MCTB number"
          description="Assign your own Telnyx number for real missed-call recovery. You'll forward your business line to this number next."
          onBack={previousStep ? goBack : undefined}
          onPrimary={
            data?.trialNumber.provisioned
              ? () => void post({ step: "configure" })
              : undefined
          }
          primaryLabel="Continue"
          primaryDisabled={!data?.trialNumber.provisioned}
          primaryLoading={saving}
          footer={
            !data?.trialNumber.provisioned ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {previousStep ? (
                  <Button type="button" variant="outline" size="sm" onClick={goBack} disabled={saving}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                {!saving ? (
                  <Button onClick={() => void provisionTrialNumber()} className="shadow-sm" size="sm">
                    Assign my production number
                  </Button>
                ) : null}
              </div>
            ) : undefined
          }
        >
          {saving ? (
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Assigning your production number…
            </div>
          ) : !data?.trialNumber.provisioned ? (
            <MctbCallout icon={Phone} title="Ready when you are">
              Assign a Telnyx number only when you are ready to use your own production line. If
              you already have a number in MCTB setup, that saved number is used instead.
            </MctbCallout>
          ) : (
            <MctbConnectionStatusCard
              title="Your production MCTB number"
              rows={[
                {
                  label: "Text-back sender",
                  value: trialDisplay || "—",
                  mono: true,
                  status: "ready",
                },
                {
                  label: "Voice ingress",
                  value: data?.trialNumber.voiceStatus || "Ready",
                  status: "ready",
                },
                {
                  label: "Text messaging",
                  value: data?.trialNumber.tfvStatusLabel || "Verification required",
                  status: data?.trialNumber.messagingApproved ? "ready" : "pending",
                },
              ]}
              footer={
                <p className="text-[12px] leading-relaxed text-[#6b7280]">
                  Next: activate texting, then forward your business line to this number.
                </p>
              }
            />
          )}
        </MctbWizardStepShell>
      ) : null}

      {step === "configure" ? (
        <MctbWizardStepShell
          icon={MessageSquare}
          title="Configure text back"
          description={`Recovery message sent when you miss a call on ${trialDisplay || "your Transovo number"}.`}
          onBack={previousStep ? goBack : undefined}
          onSaveExit={() => router.push(MCTB_ROUTES.setup)}
          onPrimary={() => void post({ messageTemplate: messageTemplate.trim() })}
          primaryDisabled={!messageTemplate.trim()}
          primaryLoading={saving}
          banner={false}
        >
          <MctbTextBackComposer
            message={messageTemplate}
            onMessageChange={setMessageTemplate}
            press1Mode={consentMode === "press_1"}
            compliancePreview="Reply YES to confirm you want text messages from this business. Msg & data rates may apply. Reply STOP to opt out."
            variablesHint="{{customer.firstName}} · {{business.name}}"
          />
        </MctbWizardStepShell>
      ) : null}

      {step === "consent" ? (
        <MctbWizardStepShell
          icon={ShieldCheck}
          title="Consent for missed-call texting"
          description="Choose how Transovo establishes or relies on permission to text missed callers."
          onBack={previousStep ? goBack : undefined}
          onSaveExit={() => router.push(MCTB_ROUTES.setup)}
          onPrimary={() =>
            void post({
              consentMode,
              existingConsentAttested:
                consentMode === "existing_consent" ? true : undefined,
            })
          }
          primaryDisabled={
            saving || (consentMode === "existing_consent" && !existingConsentAttested)
          }
          primaryLoading={saving}
          banner={false}
        >
          <MctbConsentModeCards
            value={consentMode}
            onChange={setConsentMode}
            attested={existingConsentAttested}
            onAttestedChange={setExistingConsentAttested}
            options={[
              {
                id: "press_1",
                title: "Ask callers to press 1",
                subtitle: "Transovo plays a disclosure and captures DTMF 1 before texting.",
                audience: "Businesses that need platform-captured consent on each call.",
                badge: "Recommended",
                icon: ShieldCheck,
                nextSteps: [
                  "Caller hears your Press-1 disclosure on the missed call.",
                  "Pressing 1 creates a consent event tied to that call.",
                  "System compliance SMS sends, then your recovery opener.",
                ],
              },
              {
                id: "existing_consent",
                title: "Use permission my business already has",
                subtitle: "No Press 1 — you attest that compliant permission already exists.",
                audience: "Businesses with documented prior opt-in for this use case.",
                icon: FileCheck,
                nextSteps: [
                  "Missed call is classified without a voice consent prompt.",
                  "Eligibility checks run before any recovery text.",
                  "You remain responsible for proving existing permission.",
                ],
              },
            ]}
          />
        </MctbWizardStepShell>
      ) : null}

      {step === "demo" ? (
        <MctbWizardStepShell
          icon={Sparkles}
          title="Try it now — call the demo line"
          description={
            data?.demo.description ||
            "No forwarding required. Call from your verified mobile and experience recovery in under two minutes."
          }
          onBack={previousStep ? goBack : undefined}
          footer={
            !data?.demo.completed ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={
                    saving || (consentMode === "existing_consent" && !existingConsentAttested)
                  }
                  onClick={() => void startDemo()}
                  className="shadow-sm"
                >
                  <Phone className="mr-2 h-4 w-4" aria-hidden />
                  I&apos;m ready — start demo
                </Button>
                {data?.demo.checks.textDelivered ? (
                  <p className="text-[13px] text-muted-foreground">
                    Reply to the text to complete the demo.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[13px] font-medium text-emerald-800">
                  That&apos;s what your customers will experience.
                </p>
                <Button onClick={() => void post({ step: "trial_number" })} className="shadow-sm">
                  Continue — get your production number
                </Button>
              </div>
            )
          }
        >
          <MctbHeroNumber
            label={data?.demo.label || "Approved demo number"}
            number={demoNumberDisplay}
            hint="Call directly from your verified mobile. Let it ring without answering — do not forward."
            tint="blue"
          />

          <MctbVerificationTimeline
            title="Live demo progress"
            passed={data?.demo.completed}
            passedTitle="Demo complete — you're ready for a production number"
            waitingHint="Checkpoints update automatically when your demo call completes."
            steps={[
              {
                id: "mode",
                label:
                  consentMode === "existing_consent"
                    ? "Consent mode: existing permission"
                    : "Consent mode: Press 1 on the call",
                done: true,
              },
              {
                id: "call",
                label: "Call detected on demo line",
                done: data?.demo.checks.callDetected || false,
              },
              {
                id: "missed",
                label: "Classified as missed call",
                done: data?.demo.checks.missedCall || false,
              },
              {
                id: "text",
                label: "Recovery text received",
                done: data?.demo.checks.textDelivered || false,
              },
              {
                id: "reply",
                label: "Reply received (optional)",
                detail: "Reply to the text to experience the full conversation loop.",
                done: data?.demo.checks.replyReceived || false,
              },
            ]}
          />
        </MctbWizardStepShell>
      ) : null}

      {step === "tfv" || step === "pending" ? (
        <MctbWizardStepShell
          icon={ShieldCheck}
          title={
            tfvApproved
              ? usesA2pPath
                ? "A2P messaging is ready"
                : "Your number is ready"
              : usesA2pPath
                ? "Activate A2P texting on your number"
                : "Activate texting on your number"
          }
          description={
            usesA2pPath
              ? `Telnyx 10DLC / A2P for ${trialDisplay || "your assigned number"}. Pre-approved numbers skip this wait.`
              : `Toll-free verification for ${trialDisplay || "your assigned number"}. Your trial clock has not started yet.`
          }
          onBack={previousStep ? goBack : undefined}
          onPrimary={tfvApproved ? () => void post({ step: "connect" }) : undefined}
          primaryLabel="Connect your business calls"
          primaryLoading={saving}
          footer={
            !tfvApproved ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {previousStep ? (
                  <Button type="button" variant="outline" size="sm" onClick={goBack} disabled={saving}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={saving}
                    className="shadow-sm"
                    size="sm"
                    onClick={() =>
                      void (async () => {
                        setSaving(true);
                        setError(null);
                        try {
                          const res = await fetch("/api/mctb/tfv", { method: "POST" });
                          const json = await res.json();
                          if (!res.ok) throw new Error(json.error || "Submit failed");
                          await load();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Submit failed");
                        } finally {
                          setSaving(false);
                        }
                      })()
                    }
                  >
                    {tfvActionRequired ? "Resubmit verification" : "Submit toll-free verification"}
                  </Button>
                  <Link
                    href="/compliance"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-[13px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Complete business details
                  </Link>
                </div>
              </div>
            ) : undefined
          }
        >
          <MctbMessagingActivationPanel
            statusLabel={data?.trialNumber.tfvStatusLabel || data?.tfv.status || "Not started"}
            usesA2pPath={usesA2pPath}
            approved={tfvApproved}
            actionRequired={tfvActionRequired}
            failureReason={tfvFailureReason}
            numberDisplay={trialDisplay || "—"}
          />
          {step === "pending" && !tfvApproved ? (
            <p className="mt-3 text-[13px] text-muted-foreground">
              Your number is being verified for texting. You can configure forwarding early — your
              trial clock has not started.
            </p>
          ) : null}
        </MctbWizardStepShell>
      ) : null}

      {step === "connect" ? (
        <MctbWizardStepShell
          icon={PhoneMissed}
          title="Phone & forwarding"
          description={`Connect your business line and forward unanswered calls to ${forwardDisplay}.`}
          onBack={previousStep ? goBack : undefined}
          onSaveExit={() => router.push(MCTB_ROUTES.setupPhone)}
          banner={false}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={saving || !businessNumber.trim()}
                onClick={() =>
                  void post({
                    forwardingCarrier: carrier,
                    businessNumberE164: businessNumber,
                    forwardingRingSeconds: forwardRingSeconds,
                  })
                }
              >
                Save progress
              </Button>
              <Button
                size="sm"
                className="shadow-sm"
                disabled={saving || !businessNumber.trim()}
                onClick={async () => {
                  await post({
                    forwardingCarrier: carrier,
                    businessNumberE164: businessNumber,
                    forwardingRingSeconds: forwardRingSeconds,
                  });
                  setForwardingTestActive(true);
                  await fetch("/api/mctb/onboarding", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "start_forwarding_test" }),
                  });
                  await load();
                }}
              >
                I&apos;ve turned it on — verify forwarding
              </Button>
            </div>
          }
        >
          {!forwardE164 ? (
            <MctbCallout icon={Phone} title="Assign your MCTB number first" variant="warning">
              Assign your production number in the previous step or in{" "}
              <Link href={MCTB_ROUTES.setup} className="font-semibold text-primary hover:underline">
                Setup
              </Link>{" "}
              before configuring forwarding.
            </MctbCallout>
          ) : null}
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
        </MctbWizardStepShell>
      ) : null}

      {step === "live_test" ? (
        <MctbWizardStepShell
          icon={Zap}
          title="Live verification"
          description={`Call ${businessNumber || "your business line"} from another phone. Don't answer — we'll recover the miss on ${forwardDisplay}.`}
          onBack={previousStep ? goBack : undefined}
          banner={false}
        >
          <MctbVerificationTimeline
            title="End-to-end recovery test"
            passed={data?.liveTest.passed}
            passedTitle="Live test passed — starting your trial"
            waitingHint="Checkpoints update automatically when your test call completes."
            steps={[
              {
                id: "call",
                label: `Call arrived on MCTB number (${forwardDisplay})`,
                done: data?.liveTest.checks.callDetected || false,
              },
              {
                id: "missed",
                label: "Classified as missed call",
                done: data?.liveTest.checks.missedCall || false,
              },
              {
                id: "consent",
                label: "Consent completed (if required)",
                done: data?.liveTest.checks.consentCompleted || false,
              },
              {
                id: "sent",
                label: "Recovery SMS sent",
                done: data?.liveTest.checks.textSent || false,
              },
              {
                id: "delivered",
                label: "SMS delivered",
                done: data?.liveTest.checks.textDelivered || false,
              },
              {
                id: "reply",
                label: "Reply received in Transovo",
                detail: "Optional — reply to the text to complete the full loop.",
                done: data?.liveTest.checks.replyReceived || false,
              },
            ]}
          />
        </MctbWizardStepShell>
      ) : null}

      {step === "complete" ? (
        <div className="ref-card overflow-hidden text-center">
          <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 px-6 py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" aria-hidden />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-gray-900">
              Your 14-day free trial starts now
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-gray-600">
              Missed Call Text Back is live. Day 1 of 14 begins today — not while you were waiting on
              verification.
            </p>
            <Button className="mt-6 shadow-sm" onClick={() => router.push(MCTB_ROUTES.home)}>
              Go to Overview
            </Button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
