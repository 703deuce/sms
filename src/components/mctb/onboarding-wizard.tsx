"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCarrierStep, type CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import type {
  MctbConsentMode,
  MctbForwardingCarrier,
  MctbOnboardingState,
  MctbOnboardingStep,
  MctbTfvStatus,
} from "@/lib/mctb/onboarding/types";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Phone,
  PhoneMissed,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function StepCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={done ? "text-emerald-900" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

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
      void fetch("/api/mctb/demo", { cache: "no-store" })
        .then((r) => r.json())
        .then((j) => {
          if (!j.data) return;
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  demo: { ...prev.demo, ...j.data },
                }
              : prev,
          );
          if (j.data.completed) void load();
        })
        .catch(() => undefined);
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

  async function startDemo() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

  const selectedCarrier = data?.carriers.find((c) => c.id === carrier);
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-medium text-primary">Missed Call Text Back</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Set up missed-call recovery for your business
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {stepIndex + 1} of {data?.steps.length || 10}: {data?.stepLabels[step]}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {data?.steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              i === stepIndex
                ? "bg-primary text-primary-foreground"
                : i < stepIndex
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {data.stepLabels[s]}
          </span>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {step === "business" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Business information</h2>
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Acme Plumbing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website (optional)</Label>
            <Input
              id="website"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://acmeplumbing.com"
            />
          </div>
          <Button
            disabled={!businessName.trim() || saving}
            onClick={() =>
              void post({ businessName: businessName.trim(), websiteUrl: websiteUrl.trim() })
            }
          >
            Continue
          </Button>
        </Card>
      ) : null}

      {step === "trial_number" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Your production MCTB number</h2>
          <p className="text-sm text-muted-foreground">
            Now that you&apos;ve tried the demo, we assign your own Telnyx number for real
            missed-call recovery. You&apos;ll forward your business line to this number next.
          </p>
          {saving ? (
            <div className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Assigning your production number…
            </div>
          ) : !data?.trialNumber.provisioned ? (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">
                Assign a Telnyx number only when you are ready to use your own production line.
                If you already have a number in MCTB setup, that saved number is used instead.
              </p>
              <Button onClick={() => void provisionTrialNumber()}>Assign my production number</Button>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
              <p className="text-sm font-medium text-muted-foreground">Your Transovo number</p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary">
                {trialDisplay}
              </p>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-muted-foreground">Voice</p>
                  <p className="font-medium text-emerald-700">Ready</p>
                </div>
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-muted-foreground">Text messaging</p>
                  <p className="font-medium">Verification required</p>
                </div>
              </div>
            </div>
          )}
          {data?.trialNumber.provisioned ? (
            <Button onClick={() => void post({ step: "configure" })}>Continue</Button>
          ) : null}
        </Card>
      ) : null}

      {step === "configure" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Configure text back</h2>
          <p className="text-sm text-muted-foreground">
            This message is sent when you miss a call on {trialDisplay || "your Transovo number"}.
          </p>
          <div className="space-y-2">
            <Label htmlFor="message">Recovery message</Label>
            <textarea
              id="message"
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
            />
          </div>
          <Button
            disabled={!messageTemplate.trim() || saving}
            onClick={() => void post({ messageTemplate: messageTemplate.trim() })}
          >
            Continue
          </Button>
        </Card>
      ) : null}

      {step === "consent" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">How should missed-call texting be authorized?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: "press_1" as const,
                  title: "Ask callers to press 1",
                  badge: "Recommended",
                  desc: "We play a short disclosure and only text callers who press 1.",
                },
                {
                  id: "existing_consent" as const,
                  title: "I already have permission to text these callers",
                  desc: "No Press 1. You certify that you already have the required consent.",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setConsentMode(opt.id)}
                className={cn(
                  "rounded-xl border p-4 text-left transition",
                  consentMode === opt.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40",
                )}
              >
                <p className="font-medium">
                  {opt.title}
                  {"badge" in opt && opt.badge ? (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {opt.badge}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
          {consentMode === "existing_consent" ? (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={existingConsentAttested}
                onChange={(e) => setExistingConsentAttested(e.target.checked)}
              />
              <span>
                I certify that I have the required permission to send SMS messages to callers
                covered by this setup.
              </span>
            </label>
          ) : null}
          {consentMode === "press_1" ? (
            <p className="text-sm text-muted-foreground">
              After onboarding, customize your spoken Press-1 script and generate audio in{" "}
              <Link href="/voice/setup" className="font-medium text-primary hover:underline">
                Setup → Verified Call Consent
              </Link>
              . Live calls play your saved recording before collecting Press 1.
            </p>
          ) : null}
          <Button
            disabled={
              saving ||
              (consentMode === "existing_consent" && !existingConsentAttested)
            }
            onClick={() =>
              void post({
                consentMode,
                existingConsentAttested:
                  consentMode === "existing_consent" ? true : undefined,
              })
            }
          >
            Continue
          </Button>
        </Card>
      ) : null}

      {step === "demo" ? (
        <Card className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Try it now — call the demo line directly</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data?.demo.description ||
                  "No forwarding or carrier setup. Call from your verified mobile and experience the product in under two minutes."}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm">
            <p className="font-medium">Demo consent mode</p>
            <p className="mt-1 text-muted-foreground">
              {consentMode === "existing_consent"
                ? "Existing Consent — no Press 1; recovery text sends after the missed call."
                : "Press 1 — hear the greeting and press 1 to receive the recovery text. No press, no text."}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  { id: "press_1" as const, title: "Press 1" },
                  { id: "existing_consent" as const, title: "Existing Consent" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setConsentMode(opt.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition",
                    consentMode === opt.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {opt.title}
                </button>
              ))}
            </div>
            {consentMode === "existing_consent" ? (
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={existingConsentAttested}
                  onChange={(e) => setExistingConsentAttested(e.target.checked)}
                />
                <span>I certify I have permission to text these callers.</span>
              </label>
            ) : null}
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {data?.demo.label || "Approved Transovo Demo Number"}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary">
              {demoNumberDisplay}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Call this number directly from your verified mobile. Do not set up forwarding — let it
              ring without answering.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <StepCheck done={data?.demo.checks.callDetected || false} label="Call detected" />
            <StepCheck done={data?.demo.checks.missedCall || false} label="Missed call" />
            <StepCheck done={data?.demo.checks.textDelivered || false} label="Text received" />
            <StepCheck done={data?.demo.checks.replyReceived || false} label="Reply received" />
          </div>

          {!data?.demo.completed ? (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={
                  saving ||
                  (consentMode === "existing_consent" && !existingConsentAttested)
                }
                onClick={() => void startDemo()}
              >
                <Phone className="mr-2 h-4 w-4" />
                I&apos;m ready — start demo
              </Button>
              {data?.demo.checks.textDelivered ? (
                <p className="self-center text-sm text-muted-foreground">
                  Reply to the text to complete the demo.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-emerald-800">
                That&apos;s what your customers will experience.
              </p>
              <Button onClick={() => void post({ step: "trial_number" })}>
                Continue — get your production number
              </Button>
            </div>
          )}
        </Card>
      ) : null}

      {step === "tfv" || step === "pending" ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">
                {tfvApproved
                  ? usesA2pPath
                    ? "A2P messaging is ready"
                    : "Your number is ready"
                  : usesA2pPath
                    ? "Activate A2P texting on your number"
                    : "Activate texting on your number"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {usesA2pPath
                  ? `Telnyx 10DLC / A2P for ${trialDisplay || "your assigned number"}. Pre-approved numbers skip this wait.`
                  : `Twilio Toll-Free Verification for ${trialDisplay || "your assigned number"}. This does not use your demo line and does not start your 14-day trial yet.`}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-4 text-sm">
            <p className="text-muted-foreground">
              {usesA2pPath ? "A2P / messaging status" : "Toll-free verification status"}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {data?.trialNumber.tfvStatusLabel || data?.tfv.status || "Not started"}
            </p>
            {tfvActionRequired && tfvFailureReason ? (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
                <p className="font-medium">Twilio needs an update before approval</p>
                <p className="mt-1 whitespace-pre-wrap">{tfvFailureReason}</p>
                <p className="mt-2 text-xs text-amber-800">
                  Fix the highlighted details in Messaging Compliance, then resubmit below.
                </p>
              </div>
            ) : null}
          </div>

          {tfvApproved ? (
            <Button onClick={() => void post({ step: "connect" })}>
              Connect your business calls
            </Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={saving}
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
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium"
              >
                Complete business details
              </Link>
            </div>
          )}

          {step === "pending" && !tfvApproved ? (
            <p className="text-sm text-muted-foreground">
              Your number is being verified for texting. You can edit setup or configure forwarding
              early — but your trial clock hasn&apos;t started.
            </p>
          ) : null}
        </Card>
      ) : null}

      {step === "connect" ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <PhoneMissed className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Connect your existing business number</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Keep advertising your business line. When it isn&apos;t answered, set conditional
                forwarding to your assigned Transovo MCTB number ({forwardDisplay}). This is
                required for production — the demo used a direct call with no forwarding.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p>
              <span className="font-medium">Example:</span> Customers call{" "}
              <span className="font-mono">{businessNumber || "540-555-1234"}</span> → no answer →
              forwards to <span className="font-mono">{forwardDisplay}</span> → Transovo sends the
              recovery text.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Your advertised business phone number</Label>
            <Input
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="(540) 555-1234"
            />
          </div>

          <div className="space-y-2">
            <Label>What phone service do you use?</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {data?.carriers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCarrier(c.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition",
                    carrier === c.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {!forwardE164 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              Assign your production MCTB number in the previous step or in{" "}
              <Link href="/voice/setup" className="font-medium underline">
                Setup
              </Link>{" "}
              before configuring forwarding. Set env <code className="text-xs">MCTB_PRODUCTION_FORWARD_E164</code>{" "}
              for cert testing if you have not provisioned a DID yet.
            </p>
          ) : null}

          {selectedCarrier && forwardE164 ? (
            <>
              {selectedCarrier.capabilities.alternateSetupRequired ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-medium">Carrier timing note</p>
                  <p className="mt-1">{selectedCarrier.capabilities.alternateSetupNote}</p>
                </div>
              ) : null}
              {selectedCarrier.capabilities.voicemailRaceRisk === "high" ? (
                <p className="text-sm text-muted-foreground">
                  Forwarding must ring for about{" "}
                  <span className="font-medium">{forwardRingSeconds} seconds</span> before sending
                  the call to Transovo — shorter than your voicemail pickup. We do not ask you to
                  turn voicemail off.
                </p>
              ) : null}
              <div className="space-y-2">
                <Label>
                  Ring before Transovo catches the call (seconds)
                </Label>
                <Input
                  type="number"
                  min={10}
                  max={30}
                  value={forwardRingSeconds}
                  onChange={(e) => setForwardRingSeconds(Number(e.target.value) || 15)}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: {selectedCarrier.capabilities.recommendedForwardRingSeconds}s
                  {selectedCarrier.capabilities.defaultVoicemailPickupSeconds
                    ? ` — keep below typical voicemail (~${selectedCarrier.capabilities.defaultVoicemailPickupSeconds}s)`
                    : ""}
                </p>
              </div>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {selectedCarrier.steps.map((s) => {
                  const text = forwardE164
                    ? formatCarrierStep(s, {
                        transovoE164: forwardE164,
                        forwardRingSeconds,
                      })
                    : s.replace("YOUR_TRANSOVO_NUMBER", forwardDisplay);
                  return <li key={s}>{text}</li>;
                })}
              </ol>
            </>
          ) : null}

          {data?.forwardingVerification?.testStarted ? (
            <div className="rounded-lg border p-4 text-sm space-y-2">
              <StepCheck
                done={data.forwardingVerification.callDetected}
                label={`Call reached your MCTB number (${forwardDisplay})`}
              />
              <StepCheck
                done={data.forwardingVerification.verified}
                label="Forwarded from your business line (not a direct dial)"
              />
              {data.forwardingVerification.verified ? (
                <p className="text-emerald-800 font-medium">Forwarding verified. Continue to live test.</p>
              ) : data.forwardingVerification.callDetected ? (
                <p className="text-amber-800">
                  Call detected but not from forwarding — dial your business line and let it forward,
                  don&apos;t call the Transovo number directly.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Waiting for your test call… call your business line from another phone and don&apos;t
                  answer.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={saving || !businessNumber.trim()}
              onClick={() =>
                void post({
                  forwardingCarrier: carrier,
                  businessNumberE164: businessNumber,
                  forwardingRingSeconds: forwardRingSeconds,
                })
              }
            >
              Save setup
            </Button>
            <Button
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
              Test forwarding
            </Button>
          </div>
        </Card>
      ) : null}

      {step === "live_test" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Real live test</h2>
          <p className="text-sm text-muted-foreground">
            Call your business number ({businessNumber || "your line"}) from another phone.
            Don&apos;t answer. We&apos;ll detect the miss on {forwardDisplay} and send your recovery
            text from that number automatically.
          </p>

          <div className="space-y-2 rounded-lg border p-4">
            <StepCheck
              done={data?.liveTest.checks.callDetected || false}
              label={`Call arrived on your MCTB number (${forwardDisplay})`}
            />
            <StepCheck
              done={data?.liveTest.checks.missedCall || false}
              label="Classified as missed"
            />
            <StepCheck
              done={data?.liveTest.checks.consentCompleted || false}
              label="Consent completed (if required)"
            />
            <StepCheck done={data?.liveTest.checks.textSent || false} label="SMS sent" />
            <StepCheck
              done={data?.liveTest.checks.textDelivered || false}
              label="SMS delivered"
            />
            <StepCheck
              done={data?.liveTest.checks.replyReceived || false}
              label="Reply received in Transovo"
            />
          </div>

          {data?.liveTest.passed ? (
            <p className="text-sm font-medium text-emerald-800">
              Live test passed. Starting your 14-day trial…
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for your test call… checks update automatically.
            </p>
          )}
        </Card>
      ) : null}

      {step === "complete" ? (
        <Card className="space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="text-xl font-semibold">Your 14-day free trial starts now</h2>
          <p className="text-sm text-muted-foreground">
            Missed Call Text Back is live. Day 1 of 14 begins today — not while you were waiting on
            verification.
          </p>
          <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
        </Card>
      ) : null}
    </div>
  );
}
