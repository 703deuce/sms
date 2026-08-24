"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";

type Mode = "none" | "mctb" | "smart_routing";

type Snapshot = {
  mode: Mode;
  mctbSipIngress: boolean;
  routingOwner: string | null;
  telephonyRoutingMode: string | null;
};

const MODE_OPTIONS: Array<{
  id: Mode;
  label: string;
  description: string;
  feature: "mctb" | "smart_routing" | null;
}> = [
  {
    id: "none",
    label: "Standard",
    description: "No MCTB or Smart Routing call handling on this number.",
    feature: null,
  },
  {
    id: "mctb",
    label: "Missed Call Text Back",
    description: "Inbound calls use Press-1 consent and missed-call SMS follow-up.",
    feature: "mctb",
  },
  {
    id: "smart_routing",
    label: "Smart Routing",
    description: "Inbound calls use your phone tree / Call Control routing runtime.",
    feature: "smart_routing",
  },
];

export function CallHandlingModePanel({
  numberId,
  e164,
  entitlements,
}: {
  numberId: string;
  e164: string;
  entitlements?: { mctb?: boolean; smart_routing?: boolean };
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<Mode>("none");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setError("");
      try {
        const res = await fetch(`/api/numbers/${numberId}/call-handling-mode`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load mode");
        setSnapshot(json.data as Snapshot);
        setSelected((json.data as Snapshot).mode);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Load failed");
      }
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberId]);

  function save() {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/numbers/${numberId}/call-handling-mode`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: selected }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Save failed");
        setSnapshot(json.data as Snapshot);
        setSelected((json.data as Snapshot).mode);
        setMessage("Call handling mode saved.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const changed = snapshot ? selected !== snapshot.mode : false;

  return (
    <Card>
      <CardTitle>Inbound call handling</CardTitle>
      <p className="mt-2 text-sm text-muted-foreground">
        Choose what {e164} should do for inbound PSTN calls. Only one product handles calls at a
        time; saved Smart Routing trees are kept when you switch away.
      </p>

      <div className="mt-4 space-y-3">
        {MODE_OPTIONS.map((opt) => {
          const entitled =
            !opt.feature ||
            (opt.feature === "mctb" && entitlements?.mctb) ||
            (opt.feature === "smart_routing" && entitlements?.smart_routing);
          const active = selected === opt.id;
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                active ? "border-primary bg-primary/5" : "border-border"
              } ${!entitled ? "opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="callHandlingMode"
                className="mt-1"
                checked={active}
                disabled={!entitled || pending}
                onChange={() => setSelected(opt.id)}
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {opt.label}
                  {snapshot?.mode === opt.id ? <StatusChip status="Active" /> : null}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{opt.description}</span>
                {!entitled && opt.feature ? (
                  <span className="mt-1 block text-xs text-amber-700">
                    Requires an active {opt.feature === "mctb" ? "MCTB" : "Smart Routing"}{" "}
                    subscription.
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {snapshot ? (
        <dl className="mt-4 grid gap-2 rounded-lg bg-muted/40 p-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">MCTB SIP ingress</dt>
            <dd>{snapshot.mctbSipIngress ? "yes" : "no"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Routing owner</dt>
            <dd>{snapshot.routingOwner || "—"}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => save()} disabled={pending || !changed}>
          {pending ? "Saving…" : "Save mode"}
        </Button>
        <Button variant="outline" onClick={() => load()} disabled={pending}>
          Refresh
        </Button>
        {selected === "smart_routing" ? (
          <Link href="/smart-routing/setup">
            <Button variant="outline" size="sm">
              Open Smart Routing setup
            </Button>
          </Link>
        ) : null}
      </div>

      {message ? <p className="mt-3 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}
