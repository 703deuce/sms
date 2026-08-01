"use client";

import { PhoneSubNav } from "@/components/phone/phone-subnav";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import type { PhoneNumber } from "@/lib/types";
import { useEffect, useState } from "react";

type Tab = "caller" | "forwarding" | "voicemail" | "presence" | "admin";

export function PhoneSettingsClient({
  phoneNumbers,
  initialCallerId,
}: {
  phoneNumbers: PhoneNumber[];
  initialCallerId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("caller");
  const [callerId, setCallerId] = useState(initialCallerId || phoneNumbers[0]?.number || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [fwdMode, setFwdMode] = useState("always");
  const [fwdTarget, setFwdTarget] = useState("");
  const [fwdType, setFwdType] = useState("external");

  const [boxes, setBoxes] = useState<Array<Record<string, unknown>>>([]);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [greeting, setGreeting] = useState("Please leave a message after the tone.");

  const [presence, setPresence] = useState("available");
  const [extension, setExtension] = useState("");
  const [cellular, setCellular] = useState("");
  const [dnd, setDnd] = useState(false);
  const [intl, setIntl] = useState(false);

  useEffect(() => {
    fetch("/api/phone/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.defaultCallerIdNumber) setCallerId(j.data.defaultCallerIdNumber);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === "forwarding") {
      fetch("/api/phone/forwarding?mine=1")
        .then((r) => r.json())
        .then((j) => setRules(j.data || []))
        .catch(() => undefined);
    }
    if (tab === "voicemail") {
      fetch("/api/phone/voicemail")
        .then((r) => r.json())
        .then((j) => {
          setBoxes(j.data?.boxes || []);
          setMessages(j.data?.messages || []);
        })
        .catch(() => undefined);
    }
    if (tab === "presence") {
      fetch("/api/phone/presence")
        .then((r) => r.json())
        .then((j) => {
          const mine = (j.data || [])[0];
          if (mine?.status) setPresence(mine.status);
        })
        .catch(() => undefined);
    }
    if (tab === "admin") {
      fetch("/api/phone/admin")
        .then((r) => r.json())
        .then((j) => {
          const s = (j.data?.settings || [])[0];
          if (s) {
            setExtension(s.extension || "");
            setCellular(s.forwardToCellular || "");
            setDnd(Boolean(s.dndEnabled));
            setIntl(Boolean(s.internationalEnabled));
          }
        })
        .catch(() => undefined);
    }
  }, [tab]);

  async function saveCaller() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/phone/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultCallerIdNumber: callerId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addForwarding() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/phone/forwarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: fwdMode,
          targetType: fwdType,
          targetValue: fwdTarget,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setRules((r) => [...r, json.data]);
      setFwdTarget("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveVoicemail() {
    setSaving(true);
    try {
      await fetch("/api/phone/voicemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_personal", greetingText: greeting }),
      });
      const j = await fetch("/api/phone/voicemail").then((r) => r.json());
      setBoxes(j.data?.boxes || []);
      setMessages(j.data?.messages || []);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function savePresence() {
    await fetch("/api/phone/presence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: presence, queueAvailable: presence !== "dnd" }),
    });
    setSaved(true);
  }

  async function saveAdmin() {
    setSaving(true);
    try {
      const res = await fetch("/api/phone/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extension,
          forwardToCellular: cellular || null,
          dndEnabled: dnd,
          internationalEnabled: intl,
          defaultCallerId: callerId || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "caller", label: "Caller ID" },
    { id: "forwarding", label: "Forwarding" },
    { id: "voicemail", label: "Voicemail" },
    { id: "presence", label: "Presence" },
    { id: "admin", label: "Admin" },
  ];

  return (
    <div>
      <PageHeader
        title="Phone settings"
        description="Caller ID, forwarding, voicemail, presence, and softphone admin controls."
      />
      <PhoneSubNav />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "primary" : "outline"}
            onClick={() => {
              setTab(t.id);
              setSaved(false);
              setError("");
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {saved ? <p className="mb-3 text-sm text-emerald-600">Saved</p> : null}

      {tab === "caller" ? (
        <Card>
          <CardTitle>Caller ID</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Select which workspace number appears when agents place outbound calls.
          </p>
          <div className="mt-4 max-w-md">
            <Label htmlFor="defaultCallerId">Default caller ID number</Label>
            <select
              id="defaultCallerId"
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
            >
              {phoneNumbers.map((pn) => (
                <option key={pn.id} value={pn.number}>
                  {pn.friendlyName ? `${pn.friendlyName} · ` : ""}
                  {pn.number}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <Button onClick={saveCaller} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </Card>
      ) : null}

      {tab === "forwarding" ? (
        <Card className="space-y-4">
          <CardTitle>Call forwarding & routing</CardTitle>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Mode</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={fwdMode}
                onChange={(e) => setFwdMode(e.target.value)}
              >
                {[
                  "always",
                  "busy",
                  "unanswered",
                  "offline",
                  "simultaneous",
                  "sequential",
                  "after_hours",
                  "holiday",
                ].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Target type</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={fwdType}
                onChange={(e) => setFwdType(e.target.value)}
              >
                {["external", "user", "queue", "voicemail", "ai_agent", "device"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Target</Label>
              <Input value={fwdTarget} onChange={(e) => setFwdTarget(e.target.value)} placeholder="+1… / id" />
            </div>
          </div>
          <Button onClick={addForwarding} disabled={saving || !fwdTarget}>
            Add rule
          </Button>
          <ul className="space-y-2 text-sm">
            {rules.map((r) => (
              <li key={String(r.id)} className="rounded border border-border px-3 py-2">
                {String(r.mode)} → {String(r.targetType)}:{String(r.targetValue)}{" "}
                {r.active === false ? "(inactive)" : ""}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "voicemail" ? (
        <Card className="space-y-4">
          <CardTitle>Voicemail</CardTitle>
          <div>
            <Label>Greeting text</Label>
            <Input value={greeting} onChange={(e) => setGreeting(e.target.value)} />
          </div>
          <Button onClick={saveVoicemail} disabled={saving}>
            Save personal mailbox
          </Button>
          <div>
            <p className="mb-2 text-sm font-medium">Mailboxes ({boxes.length})</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {boxes.map((b) => (
                <li key={String(b.id)}>
                  {String(b.name)} {b.active === false ? "(inactive)" : ""}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Recent messages</p>
            <ul className="space-y-2 text-sm">
              {messages.map((m) => (
                <li key={String(m.id)} className="rounded border border-border px-3 py-2">
                  {String(m.fromE164 || "unknown")} · {m.isRead ? "read" : "unread"}
                  {m.transcriptText ? (
                    <p className="mt-1 text-muted-foreground">{String(m.transcriptText).slice(0, 160)}</p>
                  ) : null}
                </li>
              ))}
              {!messages.length ? <li className="text-muted-foreground">No messages yet</li> : null}
            </ul>
          </div>
        </Card>
      ) : null}

      {tab === "presence" ? (
        <Card className="space-y-4">
          <CardTitle>Team presence</CardTitle>
          <div className="max-w-sm">
            <Label>Your status</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={presence}
              onChange={(e) => setPresence(e.target.value)}
            >
              {["available", "busy", "on_call", "away", "dnd", "offline"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={savePresence}>Update presence</Button>
        </Card>
      ) : null}

      {tab === "admin" ? (
        <Card className="space-y-4">
          <CardTitle>Softphone admin</CardTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Extension</Label>
              <Input value={extension} onChange={(e) => setExtension(e.target.value)} />
            </div>
            <div>
              <Label>Forward to cellular</Label>
              <Input value={cellular} onChange={(e) => setCellular(e.target.value)} placeholder="+1…" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dnd} onChange={(e) => setDnd(e.target.checked)} />
            Do not disturb
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={intl} onChange={(e) => setIntl(e.target.checked)} />
            International calling enabled
          </label>
          <p className="text-xs text-muted-foreground">
            E911 address, recording permissions, and number assignments are stored on this profile.
            Set emergency address via API field e911AddressJson when provisioning.
          </p>
          <Button onClick={saveAdmin} disabled={saving}>
            Save admin settings
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
