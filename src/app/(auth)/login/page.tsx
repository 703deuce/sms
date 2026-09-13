"use client";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SmsOptIn } from "@/components/auth/sms-opt-in";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import {
  clientSafeNextPath,
  defaultAuthLandingPath,
  navigateAfterAuth,
} from "@/lib/auth/post-login-navigation";
import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { mctbShellHome } from "@/lib/products/product-shell";

function reservationFromNext(nextPath: string | null): string | undefined {
  if (!nextPath) return undefined;
  try {
    const url = new URL(nextPath, "http://local");
    return url.searchParams.get("reservation") || undefined;
  } catch {
    return undefined;
  }
}

function voiceProductNext(product: string | null): string | null {
  if (product === "numbers") return "/personal";
  if (product === "mctb") return "/onboarding/mctb";
  if (product === "voice") return isMctbV1Primary() ? mctbShellHome() : "/dashboard";
  if (product === "mass_texting" || product === "sms") {
    return "/api/products/open?product=mass_texting";
  }
  return null;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const defaultNext = defaultAuthLandingPath();
  const productNext = voiceProductNext(params.get("product"));
  const nextPath = params.get("next") || productNext || defaultNext;
  const reservationId = useMemo(() => reservationFromNext(params.get("next")), [params]);
  const oauthError = params.get("error");
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
        next: params.get("next") || undefined,
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
    const json = (await res.json().catch(() => ({}))) as { redirectPath?: string };
    const redirect =
      clientSafeNextPath(json.redirectPath) ||
      clientSafeNextPath(nextPath) ||
      defaultAuthLandingPath();
    navigateAfterAuth(redirect, router);
  }

  const displayOauthError =
    oauthError && oauthError !== "google_not_configured"
      ? oauthError.replace(/_/g, " ")
      : "";

  return (
    <div className="surface rounded-2xl p-8">
      <div className="mb-8 text-center">
        <p className="font-display text-3xl font-semibold tracking-tight text-primary">
          Transovo
        </p>
        <h1 className="mt-3 font-display text-xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {reservationId
            ? "Sign in to finish checkout for your reserved number."
            : "Sign in to manage your numbers, missed-call text back, and voicemail."}
        </p>
      </div>

      <GoogleSignInButton nextPath={nextPath} reservationId={reservationId} className="mb-4" />

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <p className="relative mx-auto w-fit bg-background px-2 text-xs text-muted-foreground">
          or sign in with email
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="you@email.com" />
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
          <p className="mt-1 text-right text-xs">
            <Link href="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </p>
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
        {displayOauthError ? <p className="text-sm text-danger">{displayOauthError}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : requires2fa ? "Verify & sign in" : "Sign in"}
        </Button>
      </form>
      <div className="mt-6 border-t border-border pt-6">
        <h2 className="text-center text-sm font-semibold">Sign-in phone verification</h2>
        <p className="mb-4 mt-1 text-center text-xs text-muted-foreground">
          Optionally confirm your mobile number with a one-time SMS code from Transovo. The
          message is sent only after you request it.
        </p>
        <SmsOptIn />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Transovo?{" "}
        <Link
          href={
            nextPath !== defaultNext
              ? `/signup?next=${encodeURIComponent(nextPath)}`
              : "/signup"
          }
          className="font-medium text-primary hover:underline"
        >
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
