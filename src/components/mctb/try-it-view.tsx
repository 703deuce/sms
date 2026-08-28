"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { TryItStatus } from "@/lib/mctb/try-it/types";

function StepCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
          done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
        )}
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

export function MctbTryItView() {
  const [consentMode, setConsentMode] = useState<MctbConsentMode>("press_1");
  const [existingConsentAttested, setExistingConsentAttested] = useState(false);
  const [status, setStatus] = useState<TryItStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/mctb/try-it");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Failed to load Try It status");
      return;
    }
    setStatus(json.data);
    if (json.data?.consentMode) setConsentMode(json.data.consentMode);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!status?.sessionActive) return;
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [status?.sessionActive, refresh]);

  async function startTest() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentMode,
          existingConsentAttested,
          context: "try_it",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Could not start Try It test");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Try It test");
    } finally {
      setStarting(false);
    }
  }

  const demoDisplay = status?.demoNumberDisplay || "—";

  const showPress1 = consentMode === "press_1";
  const started = Boolean(status?.sessionActive || status?.completed);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading Try It…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Try Missed Call Text Back</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Same Call Control voice path as production (mctb-event-only) — you call the shared demo
          number directly instead of forwarding your business line. No carrier setup required before
          A2P approval.
        </p>
      </div>

      <Card className="space-y-5 p-6">
        <div>
          <p className="text-sm font-medium">Step 1 — Choose how consent should work</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: "press_1" as const,
                  title: "Press 1 Consent",
                  body: "Call the demo number, hear the greeting, press 1, hear confirmation, then get the recovery text immediately.",
                },
                {
                  id: "existing_consent" as const,
                  title: "Existing Consent / No Press 1",
                  body: "Call the demo number. No Press 1 interaction. The demo recovery text is sent immediately.",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={started && !status?.expired}
                onClick={() => setConsentMode(opt.id)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left text-sm transition",
                  consentMode === opt.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40",
                )}
              >
                <p className="font-medium">{opt.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{opt.body}</p>
              </button>
            ))}
          </div>
          {consentMode === "existing_consent" ? (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={existingConsentAttested}
                disabled={started && !status?.expired}
                onChange={(e) => setExistingConsentAttested(e.target.checked)}
              />
              <span>I certify I have permission to text these callers.</span>
            </label>
          ) : null}
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
          <p className="text-sm font-medium text-muted-foreground">Your demo number</p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary">
            {demoDisplay}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Step 2 — Call this number directly from your verified mobile (no carrier forwarding).
            {status?.callerE164 ? (
              <>
                {" "}
                Call from{" "}
                <span className="font-semibold text-foreground">{status.callerE164}</span>.
              </>
            ) : null}
          </p>
        </div>

        {!started ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Step 3 — Start the test, then call the number and watch progress update live.
            </p>
            <Button
              disabled={
                starting || (consentMode === "existing_consent" && !existingConsentAttested)
              }
              onClick={() => void startTest()}
            >
              <Phone className="mr-2 h-4 w-4" />
              Start Test
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {status?.completed
                ? "Demo complete — check your phone for the recovery text."
                : status?.waitingForCall
                  ? "Waiting for your call…"
                  : "Call in progress…"}
            </p>
            <div className="space-y-2 rounded-lg border p-4">
              <StepCheck done={status?.checks.callReceived || false} label="Call received" />
              <StepCheck done={status?.checks.greetingPlayed || false} label="Greeting played" />
              {showPress1 ? (
                <StepCheck done={status?.checks.press1Received || false} label="Press 1 received" />
              ) : null}
              <StepCheck done={status?.checks.consentConfirmed || false} label="Consent confirmed" />
              <StepCheck
                done={status?.checks.recoverySmsQueued || false}
                label="Recovery SMS queued"
              />
              <StepCheck done={status?.checks.recoverySmsSent || false} label="Recovery SMS sent" />
            </div>
            {status?.expired ? (
              <Button variant="secondary" onClick={() => void startTest()} disabled={starting}>
                Start a new test
              </Button>
            ) : null}
          </div>
        )}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </Card>

      <p className="text-sm text-muted-foreground">
        Ready to configure your own number and forwarding?{" "}
        <Link href="/voice/setup" className="font-medium text-primary hover:underline">
          Go to Text Back Setup
        </Link>
        .
      </p>
    </div>
  );
}
