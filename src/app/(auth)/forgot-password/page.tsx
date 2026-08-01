"use client";

import { SmsOptIn } from "@/components/auth/sms-opt-in";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!phoneVerified) {
      setError("Verify your mobile number with the SMS code first.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error || "Unable to reset password.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="surface rounded-2xl p-8">
      <div className="mb-6 text-center">
        <p className="font-display text-3xl font-semibold tracking-tight text-primary">
          Transovo AI
        </p>
        <h1 className="mt-3 font-display text-xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your account email and verify your mobile number with a one-time SMS code, then
          choose a new password.
        </p>
      </div>

      {done ? (
        <div className="space-y-4 text-center">
          <p className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            Password updated. You can sign in with your new password.
          </p>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="reset-email">Work email</Label>
            <Input
              id="reset-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Transovo AI will send a one-time verification code by SMS after you request it. The
              code is only used to confirm your number for password recovery.
            </p>
            <SmsOptIn
              onVerified={(verifiedPhone) => {
                setPhone(verifiedPhone);
                setPhoneVerified(true);
              }}
            />
          </div>

          {phoneVerified ? (
            <div>
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                name="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <Button type="submit" className="w-full" disabled={loading || !phoneVerified}>
            {loading ? "Updating..." : "Reset password"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
