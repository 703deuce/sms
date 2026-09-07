"use client";

import { useState } from "react";
import { ShieldCheck, ArrowLeft } from "lucide-react";

export function FraudChallengeStep({
  onBack,
  onVerified,
}: {
  onBack: () => void;
  onVerified: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError("");
    await new Promise((r) => setTimeout(r, 700));
    setChecking(false);
    if (answer.trim() !== "7") {
      setError("That answer didn't match. Please try again.");
      return;
    }
    onVerified();
  }

  return (
    <div className="mx-auto max-w-lg">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Quick verification</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              To protect against automated bookings, please answer this question before continuing.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="challenge" className="text-[12px] font-semibold text-foreground">
              What is 3 + 4?
            </label>
            <input
              id="challenge"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px]"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-[12.5px] font-medium text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={checking || !answer.trim()}
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
          >
            {checking ? "Checking…" : "Continue booking"}
          </button>
        </form>
      </div>
    </div>
  );
}
