"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { useEffect, useState } from "react";

type Policy = Record<string, unknown>;

const MODE_KEYS = [
  "readExternalData",
  "createNotes",
  "createTasks",
  "manageTags",
  "updateContacts",
  "updateDeals",
  "createTickets",
  "ticketReplies",
  "manageAppointments",
  "orderNotes",
  "sendSms",
  "bulkActions",
  "preapprovedAutomations",
] as const;

export function AiPolicyClient() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/native/ai?view=policy")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setPolicy(j.data?.policy || null);
      })
      .catch(() => setError("Failed to load policy"));
  }, []);

  async function save() {
    if (!policy) return;
    setSaved(false);
    const res = await fetch("/api/integrations/native/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "save_policy", policy }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error || "Save failed");
    else {
      setPolicy(j.data.policy);
      setSaved(true);
    }
  }

  if (!policy) {
    return <p className="text-sm text-muted-foreground">{error || "Loading…"}</p>;
  }

  return (
    <div>
      <PageHeader
        title="AI integration permissions"
        description="Administrators control what AI may read or change through the same normalized action registry as automations. Level 4 actions always need fresh approval."
      />
      <div className="mb-4 text-sm">
        <Link href="/integrations/native" className="underline">
          ← Native integrations
        </Link>
      </div>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="mb-3 text-sm text-emerald-700">Saved.</p> : null}

      <Card className="mb-4 p-4">
        <CardTitle className="text-base">Permission modes</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Disabled · Approval required · Allowed under policy
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {MODE_KEYS.map((key) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block text-muted-foreground">{key}</span>
              <select
                className="w-full rounded border px-2 py-1.5"
                value={String(policy[key] || "approval_required")}
                onChange={(e) => setPolicy({ ...policy, [key]: e.target.value })}
              >
                <option value="disabled">Disabled</option>
                <option value="approval_required">Approval required</option>
                <option value="allowed">Allowed under policy</option>
              </select>
            </label>
          ))}
        </div>
      </Card>

      <Card className="mb-4 p-4">
        <CardTitle className="text-base">Limits</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["maxRecordsPerAction", "Max records per action"],
              ["maxMessagesPerAction", "Max messages per action"],
              ["dailyActionLimit", "Daily AI action limit"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block text-muted-foreground">{label}</span>
              <input
                type="number"
                className="w-full rounded border px-2 py-1.5"
                value={Number(policy[key] || 0)}
                onChange={(e) => setPolicy({ ...policy, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Allowed providers (comma-separated, empty = all)</span>
            <input
              className="w-full rounded border px-2 py-1.5"
              value={Array.isArray(policy.allowedProviders) ? policy.allowedProviders.join(",") : ""}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  allowedProviders: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-muted-foreground">Allowed roles (comma-separated)</span>
            <input
              className="w-full rounded border px-2 py-1.5"
              value={Array.isArray(policy.allowedRoles) ? policy.allowedRoles.join(",") : ""}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  allowedRoles: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
        </div>
      </Card>

      <button
        type="button"
        className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white"
        onClick={save}
      >
        Save policy
      </button>
    </div>
  );
}
