"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Snapshot = {
  operating: { state: string; reason?: string };
  onCall: { label: string } | null;
};

export default function VoiceOperationsPage() {
  const [agentId, setAgentId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [onCallLabel, setOnCallLabel] = useState("");
  const [onCallUntil, setOnCallUntil] = useState("");
  const [closureUntil, setClosureUntil] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSnapshot() {
    if (!agentId.trim()) return;
    setError("");
    const res = await fetch(
      `/api/voice-v2/operations/snapshot?agentId=${encodeURIComponent(agentId.trim())}`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Failed to load");
      return;
    }
    setSnapshot(json);
    setOnCallLabel(json.onCall?.label || "");
  }

  useEffect(() => {
    void loadSnapshot();
  }, [agentId]);

  async function saveOnCallOverride() {
    if (!agentId.trim() || !onCallUntil) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/voice-v2/operations/on-call-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: agentId.trim(),
        label: onCallLabel || "On-call",
        effectiveUntil: new Date(onCallUntil).toISOString(),
        previousTarget: snapshot?.onCall?.label,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    await loadSnapshot();
  }

  async function saveTemporaryClosure() {
    if (!agentId.trim() || !closureUntil) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/voice-v2/operations/temporary-closure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: agentId.trim(),
        endsAt: new Date(closureUntil).toISOString(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    await loadSnapshot();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-4 pb-16">
      <header>
        <h1 className="text-xl font-semibold">After-hours operations</h1>
        <p className="text-sm text-muted-foreground">
          Tonight&apos;s operating state, on-call override, and temporary closure — no republish required.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="agentId">Voice agent ID</Label>
        <Input
          id="agentId"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="Agent ID from wizard"
        />
        <Button type="button" variant="secondary" onClick={() => void loadSnapshot()}>
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {snapshot ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-medium">Operating state</h2>
          <p className="mt-1 text-lg">{snapshot.operating.state}</p>
          {snapshot.operating.reason ? (
            <p className="text-sm text-muted-foreground">{snapshot.operating.reason}</p>
          ) : null}
          <p className="mt-2 text-sm">
            On-call: <strong>{snapshot.onCall?.label || "None"}</strong>
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium">Change on-call (tonight)</h2>
        <Label htmlFor="onCallLabel">Name / label</Label>
        <Input id="onCallLabel" value={onCallLabel} onChange={(e) => setOnCallLabel(e.target.value)} />
        <Label htmlFor="onCallUntil">Until (local)</Label>
        <Input
          id="onCallUntil"
          type="datetime-local"
          value={onCallUntil}
          onChange={(e) => setOnCallUntil(e.target.value)}
        />
        <Button type="button" disabled={busy} onClick={() => void saveOnCallOverride()}>
          Save on-call override
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="font-medium">Close temporarily</h2>
        <Label htmlFor="closureUntil">Until</Label>
        <Input
          id="closureUntil"
          type="datetime-local"
          value={closureUntil}
          onChange={(e) => setClosureUntil(e.target.value)}
        />
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void saveTemporaryClosure()}>
          Apply temporary closure
        </Button>
      </section>

      <p className="text-xs text-muted-foreground">
        Callbacks and unresolved calls: use{" "}
        <a href="/voice/callback-requests" className="underline">Callbacks</a> and call history. Analytics:{" "}
        <a href="/voice/analytics" className="underline">Voice analytics</a>.
      </p>
    </div>
  );
}
