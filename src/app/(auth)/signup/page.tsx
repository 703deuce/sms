"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        businessName: form.get("businessName"),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Unable to create account.");
      return;
    }
    router.push("/getting-started");
    router.refresh();
  }

  return (
    <div className="surface rounded-2xl p-8">
      <div className="mb-8 text-center">
        <p className="font-display text-3xl font-semibold tracking-tight text-primary">
          Transovo EHS
        </p>
        <h1 className="mt-3 font-display text-xl font-semibold">Start texting compliantly</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register, get a number, import contacts, and send your first campaign.
        </p>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" required placeholder="Alex Rivera" />
        </div>
        <div>
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            name="businessName"
            required
            placeholder="Harbor Home Services"
          />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required placeholder="you@company.com" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required minLength={8} />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
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
