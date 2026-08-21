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
    configured: boolean;
    demoNumberE164: string | null;
    demoNumberDisplay: string | null;
    checks: {
      missedCallDetected: boolean;
      textDelivered: boolean;
      replyReceived: boolean;
    };
    completed: boolean;
    expired: boolean;
  };
  compliance: {
    requiredActions: string[];
    brandStatus: string;
    campaignStatus: string;
    approved: boolean;
  };
  carriers: CarrierForwardingGuide[];
  trialRequirements: {
    complianceApproved: boolean;
    numberConnected: boolean;
    liveTestPassed: boolean;
    missing: string[];
  };
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
                  demo: {
                    ...prev.demo,
                    checks: j.data.checks,
                    completed: j.data.completed,
                    expired: j.data.expired,
                    demoNumberDisplay: j.data.demoNumberDisplay,
                    configured: j.data.configured,
                  },
                }
              : prev,
          );
          if (j.data.completed) void load();
        })
        .catch(() => undefined);
    }, 2500);
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
      if (json.state) setData((prev) => (prev ? { ...prev, state: json.state } : prev));
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
          See it work before you connect your number
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Step {stepIndex + 1} of {data?.steps.length || 9}: {data?.stepLabels[step]}
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
          <h2 className="text-lg font-semibold">Tell us about your business</h2>
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Acme Plumbing"
            />
          </div>
          <Button
            disabled={!businessName.trim() || saving}
            onClick={() => void post({ businessName: businessName.trim() })}
          >
            Continue
          </Button>
        </Card>
      ) : null}

      {step === "configure" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Configure your missed-call text</h2>
          <p className="text-sm text-muted-foreground">
            This is the message customers receive when you miss a call. You can customize it later.
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
          <h2 className="text-lg font-semibold">How will customers consent to texts?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: "press_1" as const,
                  title: "Press 1 Verified Consent",
                  desc: "Caller hears a disclosure and presses 1 to receive the follow-up text.",
                },
                {
                  id: "existing_consent" as const,
                  title: "Existing Consent",
                  desc: "You already have documented consent (e.g. web form, prior relationship).",
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
                <p className="font-medium">{opt.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
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
              <h2 className="text-lg font-semibold">Test Missed Call Text Back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Call our demo number from your mobile. Let it ring — nobody will answer. You&apos;ll
                receive a demo text within seconds.
              </p>
            </div>
          </div>

          {data?.demo.demoNumberDisplay ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
              <p className="text-sm font-medium text-muted-foreground">Call this number</p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary">
                {data.demo.demoNumberDisplay}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                From the mobile number you verified at signup
              </p>
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border p-4">
            <StepCheck done={data?.demo.checks.missedCallDetected || false} label="Missed call detected" />
            <StepCheck done={data?.demo.checks.textDelivered || false} label="Text delivered" />
            <StepCheck done={data?.demo.checks.replyReceived || false} label="Reply received" />
          </div>

          {!data?.demo.completed ? (
            <div className="flex flex-wrap gap-3">
              <Button disabled={saving} onClick={() => void startDemo()}>
                <Phone className="mr-2 h-4 w-4" />
                I&apos;m ready — start demo
              </Button>
              {data?.demo.checks.textDelivered ? (
                <p className="text-sm text-muted-foreground self-center">
                  Reply to the text to complete the demo.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-emerald-800">
                Your test worked. That&apos;s what your customers will experience.
              </p>
              <Button onClick={() => void post({ step: "compliance" })}>Continue to verification</Button>
            </div>
          )}
        </Card>
      ) : null}

      {step === "compliance" || step === "pending" ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">
                {data?.compliance.approved
                  ? "Your messaging is approved"
                  : "Ready to use this on your business calls?"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Mobile carriers require your business texting to be verified first. You don&apos;t
                need to configure call forwarding yet.
              </p>
            </div>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Brand</p>
              <p className="font-medium">{data?.compliance.brandStatus}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Campaign</p>
              <p className="font-medium">{data?.compliance.campaignStatus}</p>
            </div>
          </div>

          {data?.compliance.approved ? (
            <Button onClick={() => void post({ step: "connect" })}>Connect your business number</Button>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/compliance"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                onClick={() => void post({ complianceSubmitted: true })}
              >
                Submit verification
              </Link>
              <Link
                href="/compliance"
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium"
              >
                Open compliance center
              </Link>
            </div>
          )}

          {step === "pending" && !data?.compliance.approved ? (
            <p className="text-sm text-muted-foreground">
              Verification is pending. You can connect your business number now or after approval.
            </p>
          ) : null}
        </Card>
      ) : null}

      {step === "connect" ? (
        <Card className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <PhoneMissed className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Connect your business number</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set up conditional call forwarding so missed calls on your real business line trigger
                Transovo.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Your business phone number</Label>
            <Input
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
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
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : null}

          <Button
            disabled={saving}
            onClick={() =>
              void post({
                forwardingCarrier: carrier,
                businessNumberE164: businessNumber,
                forwardingConnected: true,
                step: "live_test",
              })
            }
          >
            I&apos;ve set up forwarding
          </Button>
        </Card>
      ) : null}

      {step === "live_test" ? (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Test your connection</h2>
          <p className="text-sm text-muted-foreground">
            Call your business number from another phone. Don&apos;t answer. Transovo should detect
            the missed call and send your approved recovery text.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Call {businessNumber || "your business number"} from a different phone.</li>
            <li>Let it ring without answering.</li>
            <li>Confirm you receive the recovery text on the caller phone.</li>
            <li>Reply to confirm two-way texting works.</li>
          </ol>
          <Button
            disabled={saving}
            onClick={() => void post({ liveTestPassed: true })}
          >
            Test passed — start my trial
          </Button>
        </Card>
      ) : null}

      {step === "complete" ? (
        <Card className="space-y-4 p-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="text-xl font-semibold">Your 14-day trial starts now</h2>
          <p className="text-sm text-muted-foreground">
            Missed Call Text Back is live on your business number. Day 1 of 14 begins today.
          </p>
          <Button onClick={() => router.push("/dashboard")}>Go to dashboard</Button>
        </Card>
      ) : null}
    </div>
  );
}
