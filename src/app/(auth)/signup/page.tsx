"use client";

import { SmsOptIn } from "@/components/auth/sms-opt-in";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type WorkspaceChoice = "PERSONAL" | "BUSINESS";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [workspaceType, setWorkspaceType] = useState<WorkspaceChoice>("BUSINESS");

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
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error || "Unable to create account.");
      return;
    }
    router.push(workspaceType === "PERSONAL" ? "/personal" : "/hire");
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
          One account for Personal numbers or full business communications.
        </p>
      </div>

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
            AI receptionist, Smart Routing, SMS, and automations.
          </p>
        </button>
      </div>

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
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
