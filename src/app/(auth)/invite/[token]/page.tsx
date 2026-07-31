"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type InviteInfo = {
  email: string;
  role: string;
  workspaceName: string;
  isExistingUser: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  CAMPAIGN_CREATOR: "Campaign creator",
  INBOX_AGENT: "Inbox agent",
  ANALYST: "Analyst",
  READ_ONLY: "Read only",
};

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params.token || "");

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Invitation not found");
        return json.data as InviteInfo;
      })
      .then(setInfo)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Invitation not found"));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to accept invitation");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="surface rounded-2xl p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
        <Link href="/login" className="mt-6 inline-flex">
          <Button variant="outline">Go to sign in</Button>
        </Link>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="surface rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading invitation…</p>
      </div>
    );
  }

  return (
    <div className="surface rounded-2xl p-8">
      <div className="mb-6 text-center">
        <h1 className="font-display text-xl font-semibold">Join {info.workspaceName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;ve been invited as{" "}
          <span className="font-medium text-foreground">{ROLE_LABELS[info.role] || info.role}</span>
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="inviteEmail">Email</Label>
          <Input id="inviteEmail" value={info.email} disabled readOnly />
        </div>

        {!info.isExistingUser ? (
          <div>
            <Label htmlFor="inviteName">Your name</Label>
            <Input
              id="inviteName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>
        ) : null}

        <div>
          <Label htmlFor="invitePassword">
            {info.isExistingUser ? "Password" : "Create a password"}
          </Label>
          <Input
            id="invitePassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={info.isExistingUser ? undefined : 8}
            placeholder="••••••••"
            required
          />
          {!info.isExistingUser ? (
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Joining…" : "Accept invitation"}
        </Button>
      </form>
    </div>
  );
}
