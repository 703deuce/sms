"use client";

import { SmsOptIn } from "@/components/auth/sms-opt-in";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        totpCode: form.get("totpCode") || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.requires2fa) {
        setRequires2fa(true);
        setError(form.get("totpCode") ? "Invalid two-factor code. Try again." : "");
        return;
      }
      setError(json.error || "Unable to sign in. Try again.");
      return;
    }
    router.push(params.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="surface rounded-2xl p-8">
      <div className="mb-8 text-center">
        <p className="font-display text-3xl font-semibold tracking-tight text-primary">
          Transovo AI
        </p>
        <h1 className="mt-3 font-display text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage campaigns, inbox, and compliance.
        </p>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@company.com"
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            placeholder="••••••••"
          />
        </div>
        {requires2fa ? (
          <div>
            <Label htmlFor="totpCode">Two-factor code</Label>
            <Input
              id="totpCode"
              name="totpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="123456"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the code from your authenticator app or a backup code.
            </p>
          </div>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : requires2fa ? "Verify & sign in" : "Sign in"}
        </Button>
      </form>
      <div className="mt-6 border-t border-border pt-6">
        <h2 className="text-center text-sm font-semibold">Verify your mobile number</h2>
        <p className="mb-4 mt-1 text-center text-xs text-muted-foreground">
          Confirm your phone with a one-time SMS code — like verifying an email.
        </p>
        <SmsOptIn />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Transovo?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Trouble verifying?{" "}
        <Link href="/sms-opt-in" className="font-medium text-primary hover:underline">
          Open the SMS opt-in page
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
