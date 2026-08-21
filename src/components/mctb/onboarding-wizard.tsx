"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
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
    demoNumberDisplay: string | null;
    label?: string;
    description?: string;
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
    trialNumberE164: string | null;
    businessNumberE164: string | null;
  };
  tfv: {
    status: string;
    approved: boolean;
    trialE164: string | null;
    failureReason?: string | null;
  };
  carriers: CarrierForwardingGuide[];
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
  const [carrier, setCarrier] = useState<MctbForwardingCarrier>("verizon");
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
      const res = await fetch("/api/mctb/demo", { method: "POST" });
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
  const tfvApproved = data?.tfv.approved || false;
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
          <h2 className="text-lg font-semibold">Your Transovo number</h2>
          <p className="text-sm text-muted-foreground">
            Every trial gets its own Twilio toll-free number for missed-call text back.
          </p>
          {saving || !data?.trialNumber.provisioned ? (
            <div className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
              {!data?.trialNumber.provisioned ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Assigning your toll-free number…
                </>
              ) : null}
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
          <h2 className="text-lg font-semibold">Consent method</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: "press_1" as const,
                  title: "Verified Call Consent",
                  badge: "Recommended",
                  desc: "Caller hears a disclosure and presses 1 to receive the follow-up text.",
                },
                {
                  id: "existing_consent" as const,
                  title: "I Already Have Consent",
                  desc: "You have documented consent (web form, prior relationship, etc.) and attest to it.",
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
          {consentMode === "press_1" ? (
            <p className="text-sm text-muted-foreground">
              After onboarding, customize your spoken Press-1 script and generate audio in{" "}
              <Link href="/voice/setup" className="font-medium text-primary hover:underline">
                Setup → Verified Call Consent
              </Link>
              . Live calls play your saved recording before collecting Press 1.
            </p>
          ) : null}
          <Button disabled={saving} onClick={() => void post({ consentMode })}>
            Continue
          </Button>
        </Card>
      ) : null}

      {step === "demo" ? (
        <Card className="space-y-5 p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">See how Missed Call Text Back works</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data?.demo.description ||
                  "Call Transovo's pre-approved demo line — not your assigned trial number."}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {data?.demo.label || "Approved Transovo Demo Number"}
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary">
              {data?.demo.demoNumberDisplay}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Call from your verified mobile. Let it ring — nobody will answer.
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
              <Button disabled={saving} onClick={() => void startDemo()}>
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
              <Button onClick={() => void post({ step: "tfv" })}>
                Activate texting on your number
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
                {tfvApproved ? "Your number is ready" : "Activate texting on your number"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Twilio Toll-Free Verification for {trialDisplay || "your assigned number"}. This
                does not use your demo line and does not start your 14-day trial yet.
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-4 text-sm">
            <p className="text-muted-foreground">Toll-free verification status</p>
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
                You keep advertising your business line. When it isn&apos;t answered, forward missed
                calls to your Transovo toll-free number ({trialDisplay}).
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p>
              <span className="font-medium">Example:</span> Customers call{" "}
              <span className="font-mono">{businessNumber || "540-555-1234"}</span> → no answer →
              forwards to <span className="font-mono">{trialDisplay}</span> → Transovo sends the
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

          {selectedCarrier ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {selectedCarrier.steps.map((s) => (
                <li key={s}>
                  {s.replace("YOUR_TRANSOVO_NUMBER", trialDisplay || "your Transovo number")}
                </li>
              ))}
            </ol>
          ) : null}

          <Button
            disabled={saving || !businessNumber.trim()}
            onClick={() =>
              void post({
                forwardingCarrier: carrier,
                businessNumberE164: businessNumber,
                forwardingConnected: true,
              })
            }
          >
            I&apos;ve set up forwarding
          </Button>
        </Card>
      ) : null}

      {step === "live_test" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Real live test</h2>
          <p className="text-sm text-muted-foreground">
            Call your business number ({businessNumber || "your line"}) from another phone.
            Don&apos;t answer. We&apos;ll detect the miss on {trialDisplay} and send your verified
            recovery text automatically.
          </p>

          <div className="space-y-2 rounded-lg border p-4">
            <StepCheck
              done={data?.liveTest.checks.callDetected || false}
              label="Call arrived on your Transovo number"
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
