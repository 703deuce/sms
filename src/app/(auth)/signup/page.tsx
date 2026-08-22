"use client";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SmsOptIn } from "@/components/auth/sms-opt-in";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { isNumbersPlatformOnlyLaunch } from "@/lib/workspace/platform-launch";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

type WorkspaceChoice = "PERSONAL" | "BUSINESS";

const numbersPlatformOnly = isNumbersPlatformOnlyLaunch();

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
  if (product === "voice" || product === "mctb") return "/api/products/open?product=voice";
  if (product === "numbers") return "/api/products/open?product=numbers";
  return null;
}

function resolveProductIntent(product: string | null): "voice" | "numbers" | undefined {
  if (product === "voice" || product === "mctb") return "voice";
  if (product === "numbers") return "numbers";
  return undefined;
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const productNext = voiceProductNext(params.get("product"));
  const nextPath = params.get("next") || productNext || (numbersPlatformOnly ? "/personal" : "/onboarding/mctb");
  const reservationId = useMemo(() => reservationFromNext(params.get("next")), [params]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<WorkspaceChoice>(
    numbersPlatformOnly ? "PERSONAL" : "BUSINESS",
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!phoneVerified || !phone) {
      setLoading(false);
      setError("Verify your mobile number with an SMS code before creating your account.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        businessName: workspaceType === "BUSINESS" ? form.get("businessName") : undefined,
        workspaceType,
        phone,
        productIntent: resolveProductIntent(params.get("product")),
        next: nextPath,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error || "Unable to create account.");
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="surface rounded-2xl p-8">
      <div className="mb-8 text-center">
        <p className="font-display text-3xl font-semibold tracking-tight text-primary">
          Transovo
        </p>
        <h1 className="mt-3 font-display text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {reservationId
            ? "Sign in to finish checkout for your reserved number."
            : numbersPlatformOnly
              ? "Buy numbers, forward calls, route with Smart Routing, and manage voicemail."
              : "One account for Personal numbers or full business communications."}
        </p>
      </div>

      <GoogleSignInButton nextPath={nextPath} reservationId={reservationId} className="mb-4" />

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <p className="relative mx-auto w-fit bg-background px-2 text-xs text-muted-foreground">
          or continue with email
        </p>
      </div>

      {!numbersPlatformOnly ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setWorkspaceType("PERSONAL")}
            className={`rounded-xl border p-4 text-left transition ${
              workspaceType === "PERSONAL"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            }`}
          >
            <p className="font-semibold">Personal</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Buy, keep, forward, or transfer a phone number.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceType("BUSINESS")}
            className={`rounded-xl border p-4 text-left transition ${
              workspaceType === "BUSINESS"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            }`}
          >
            <p className="font-semibold">Business</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Missed Call Text Back, Conversations, Numbers, and messaging compliance.
            </p>
          </button>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required placeholder="Alex Rivera" />
        </div>
        {workspaceType === "BUSINESS" ? (
          <div>
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              name="businessName"
              required
              placeholder="Harbor Home Services"
            />
          </div>
        ) : null}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="you@email.com" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>

        <div className="rounded-lg border border-border p-4">
          <SmsOptIn
            onVerified={(verifiedPhone) => {
              setPhone(verifiedPhone);
              setPhoneVerified(true);
            }}
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading || !phoneVerified}>
          {loading ? "Creating..." : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={nextPath !== "/personal" ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
