"use client";

import { useEffect, useState } from "react";
import { FieldRow, Panel } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

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

export function NativeAiPolicyOpus() {
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
    <div className="space-y-4">
      <Panel
        title="AI integration permissions"
        description="Administrators control what AI may read or change through the same normalized action registry as automations."
      >
        <ButtonLink href="/integrations/native" variant="outline">← Native integrations</ButtonLink>
      </Panel>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="text-sm text-muted-foreground">Saved.</p> : null}

      <Panel title="Permission modes" description="Disabled · Approval required · Allowed under policy">
        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_KEYS.map((key) => (
            <FieldRow key={key} label={key}>
              <Select
                value={String(policy[key] || "approval_required")}
                onValueChange={(v) => setPolicy({ ...policy, [key]: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">Disabled</SelectItem>
                  <SelectItem value="approval_required">Approval required</SelectItem>
                  <SelectItem value="allowed">Allowed under policy</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          ))}
        </div>
      </Panel>

      <Panel title="Limits">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["maxRecordsPerAction", "Max records per action"],
              ["maxMessagesPerAction", "Max messages per action"],
              ["dailyActionLimit", "Daily AI action limit"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                value={Number(policy[key] || 0)}
                onChange={(e) => setPolicy({ ...policy, [key]: Number(e.target.value) })}
              />
            </div>
          ))}
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="allowedProviders">Allowed providers (comma-separated, empty = all)</Label>
            <Input
              id="allowedProviders"
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
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="allowedRoles">Allowed roles (comma-separated)</Label>
            <Input
              id="allowedRoles"
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
          </div>
        </div>
      </Panel>

      <Button type="button" onClick={save}>Save policy</Button>
    </div>
  );
}
