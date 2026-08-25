"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  readCallHandlingMode,
  type CallHandlingMode,
} from "@/lib/numbers/call-handling-mode-client";

type Props = {
  numberId: string;
  e164: string;
  settingsJson?: Record<string, unknown> | null;
};

const MODE_LABELS: Record<CallHandlingMode, string> = {
  unconfigured: "Not set",
  call_forwarding: "Call Forwarding",
  smart_routing: "Smart Routing",
  mctb: "Missed Call Text Back",
};

export function CallHandlingModePanel({ numberId, e164, settingsJson }: Props) {
  const router = useRouter();
  const initial = readCallHandlingMode(settingsJson);
  const frozenSip = settingsJson?.mctbSipIngress === true;
  const callbackOnly = settingsJson?.routingOwner === "smart_routing_callback";
  const [mode, setMode] = useState<CallHandlingMode>(initial);
  const [savedMode, setSavedMode] = useState<CallHandlingMode>(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const next = readCallHandlingMode(settingsJson);
    setMode(next);
    setSavedMode(next);
  }, [settingsJson]);

  function save() {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/numbers/${numberId}/call-handling`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Save failed");
        setSavedMode(mode);
        setMessage("Call-handling mode updated. Configuration for other products is preserved.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  if (frozenSip) {
    return (
      <Card className="mb-6">
        <CardTitle>Call handling</CardTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          {e164} uses the dedicated MCTB SIP ingress path. Mode is managed by MCTB provisioning —
          not switched here.
        </p>
      </Card>
    );
  }

  if (callbackOnly) {
    return (
      <Card className="mb-6">
        <CardTitle>Call handling</CardTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          {e164} is your Business Callback Number for employee PIN access. Assign a different
          number for Smart Routing or MCTB inbound handling.
        </p>
        <Link href="/smart-routing/setup#callback-number" className="mt-2 text-sm font-medium text-primary hover:underline">
          Smart Routing setup →
        </Link>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardTitle>Call handling mode</CardTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose which product owns inbound calls on this number. Switching modes preserves your
        Smart Routing tree and MCTB settings — only the active runtime path changes.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-end">
        <div>
          <Label htmlFor="callHandlingMode">Active mode</Label>
          <Select
            id="callHandlingMode"
            value={mode}
            onChange={(e) => setMode(e.target.value as CallHandlingMode)}
            disabled={pending}
          >
            <option value="unconfigured">Not set</option>
            <option value="call_forwarding">Call Forwarding</option>
            <option value="smart_routing">Smart Routing</option>
            <option value="mctb">Missed Call Text Back</option>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending || mode === savedMode}>
            {pending ? "Saving…" : "Apply mode"}
          </Button>
          {savedMode === "call_forwarding" ? (
            <Link href="/call-forwarding">
              <Button type="button" variant="outline">Open Call Forwarding</Button>
            </Link>
          ) : null}
          {savedMode === "smart_routing" ? (
            <Link href="/smart-routing">
              <Button type="button" variant="outline">Open Smart Routing</Button>
            </Link>
          ) : null}
          {savedMode === "mctb" ? (
            <Link href="/voice/setup">
              <Button type="button" variant="outline">Open MCTB setup</Button>
            </Link>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Current: <span className="font-medium text-foreground">{MODE_LABELS[savedMode]}</span>
        {savedMode === "smart_routing" ? " — inbound calls follow your published routing tree." : null}
        {savedMode === "call_forwarding" ? " — inbound calls forward to your configured destination." : null}
        {savedMode === "mctb" ? " — inbound calls use MCTB (Smart Routing tree kept on file)." : null}
      </p>
      {message ? <p className="mt-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </Card>
  );
}
