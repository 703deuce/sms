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
  const [fwdTargets, setFwdTargets] = useState("");
  const [fwdType, setFwdType] = useState("external");
  const [ringDesktop, setRingDesktop] = useState(true);
  const [aclRecord, setAclRecord] = useState(true);
  const [aclTransfer, setAclTransfer] = useState(true);
  const [aclPark, setAclPark] = useState(true);
  const [aclListen, setAclListen] = useState(false);
  const [aclWhisper, setAclWhisper] = useState(false);
  const [aclInternational, setAclInternational] = useState(false);
  const [aclAnonymous, setAclAnonymous] = useState(false);
  const [aclConference, setAclConference] = useState(true);
  const [aclFlip, setAclFlip] = useState(true);
  const [aclMerge, setAclMerge] = useState(true);
  const [aclPlaceCall, setAclPlaceCall] = useState(true);
  const [aclBlockCaller, setAclBlockCaller] = useState(true);
  const [meUserId, setMeUserId] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [isPhoneAdmin, setIsPhoneAdmin] = useState(false);
  const [members, setMembers] = useState<Array<{ userId: string; role: string }>>([]);
  const [allSettings, setAllSettings] = useState<Array<Record<string, unknown>>>([]);

  const [boxes, setBoxes] = useState<Array<Record<string, unknown>>>([]);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [greeting, setGreeting] = useState("Please leave a message after the tone.");

  const [presence, setPresence] = useState("available");
  const [extension, setExtension] = useState("");
  const [cellular, setCellular] = useState("");
  const [dnd, setDnd] = useState(false);
  const [intl, setIntl] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [ringMobile, setRingMobile] = useState(true);
  const [screening, setScreening] = useState(false);
  const [defaultCallerIdUser, setDefaultCallerIdUser] = useState("");

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
          const mine = j.mine || (j.data || []).find((r: { userId: string }) => r.userId === j.me);
          if (mine?.status) setPresence(mine.status);
        })
        .catch(() => undefined);
    }
    if (tab === "admin") {
      fetch("/api/phone/admin")
        .then((r) => r.json())
        .then((j) => {
          const settings = (j.data?.settings || []) as Array<Record<string, unknown>>;
          setAllSettings(settings);
          setMembers(j.data?.members || []);
          setMeUserId(j.me || "");
          setIsPhoneAdmin(Array.isArray(j.permissions) && j.permissions.includes("admin_settings"));
          const targetId = editUserId || j.me;
          if (!editUserId && j.me) setEditUserId(j.me);
          const s =
            settings.find((row) => row.userId === targetId) ||
            j.mineSettings ||
            settings[0];
          if (s) applyUserSettingsRow(s);
        })
        .catch(() => undefined);
    }
  }, [tab]);

  function applyUserSettingsRow(s: Record<string, unknown>) {
    setExtension(String(s.extension || ""));
    setCellular(String(s.forwardToCellular || ""));
    setDnd(Boolean(s.dndEnabled));
    setIntl(Boolean(s.internationalEnabled));
    setRecordingEnabled(s.recordingEnabled !== false);
    setRingMobile(s.ringMobile !== false);
    setRingDesktop(s.ringDesktop !== false);
    setDefaultCallerIdUser(String(s.defaultCallerId || ""));
    const perms = (s.permissionsJson || {}) as Record<string, boolean | undefined>;
    setScreening(Boolean(perms.screening));
    setAclRecord(perms.record !== false);
    setAclTransfer(perms.transfer !== false);
    setAclPark(perms.park !== false);
    setAclListen(Boolean(perms.listen));
    setAclWhisper(Boolean(perms.whisper));
    setAclInternational(Boolean(perms.international) || Boolean(s.internationalEnabled));
    setAclAnonymous(Boolean(perms.anonymous_dial));
    setAclConference(perms.conference !== false);
    setAclFlip(perms.flip !== false);
    setAclMerge(perms.merge !== false);
    setAclPlaceCall(perms.place_call !== false);
    setAclBlockCaller(perms.block_caller !== false);
  }

  function selectEditUser(userId: string) {
    setEditUserId(userId);
    const s = allSettings.find((row) => row.userId === userId);
    if (s) applyUserSettingsRow(s);
    else {
      setExtension("");
      setCellular("");
      setDnd(false);
      setIntl(false);
      setRecordingEnabled(true);
      setRingMobile(true);
      setRingDesktop(true);
      setDefaultCallerIdUser("");
      setScreening(false);
    }
  }

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
      const multi =
        fwdMode === "simultaneous" || fwdMode === "sequential"
          ? fwdTargets
              .split(/[,\n]/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      const res = await fetch("/api/phone/forwarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: fwdMode,
          targetType: fwdType,
          targetValue: multi.length ? multi.join(",") : fwdTarget,
          configJson: multi.length ? { targets: multi } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setRules((r) => [...r, json.data]);
      setFwdTarget("");
      setFwdTargets("");
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

  async function deleteForwarding(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/phone/forwarding?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setRules((rs) => rs.filter((r) => String(r.id) !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveAdmin() {
    setSaving(true);
    setError("");
    try {
      const target = editUserId || meUserId;
      const payload: Record<string, unknown> = {
        userId: target || undefined,
        extension,
        forwardToCellular: cellular || null,
        dndEnabled: dnd,
        internationalEnabled: intl || aclInternational,
        defaultCallerId: defaultCallerIdUser || callerId || null,
        recordingEnabled,
        ringMobile,
        ringDesktop,
        screening,
      };
      // Full ACL matrix only when phone admin (API rejects otherwise).
      if (isPhoneAdmin) {
        payload.permissionsJson = {
          screening,
          record: aclRecord,
          transfer: aclTransfer,
          park: aclPark,
          listen: aclListen,
          whisper: aclWhisper,
          international: aclInternational,
          anonymous_dial: aclAnonymous,
          conference: aclConference,
          flip: aclFlip,
          merge: aclMerge,
          place_call: aclPlaceCall,
          block_caller: aclBlockCaller,
        };
      }
      const res = await fetch("/api/phone/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Save failed");
      }
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
      {saved ? <p className="mb-3 text-sm text-violet-600">Saved</p> : null}

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
          {fwdMode === "simultaneous" || fwdMode === "sequential" ? (
            <div>
              <Label>Hunt targets (comma-separated E.164)</Label>
              <Input
                value={fwdTargets}
                onChange={(e) => setFwdTargets(e.target.value)}
                placeholder="+15551110001, +15551110002"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Sequential rings one-by-one; simultaneous rings all. Unanswered advances / overflows.
              </p>
            </div>
          ) : null}
          <Button
            onClick={addForwarding}
            disabled={saving || (!fwdTarget && !fwdTargets.trim())}
          >
            Add rule
          </Button>
          <ul className="space-y-2 text-sm">
            {rules.map((r) => (
              <li
                key={String(r.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2"
              >
                <span>
                  {String(r.mode)} → {String(r.targetType)}:{String(r.targetValue)}{" "}
                  {r.active === false ? "(inactive)" : ""}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void deleteForwarding(String(r.id))}
                >
                  Delete
                </Button>
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
            <ul className="space-y-3 text-sm">
              {messages.map((m) => {
                const recordingUrl =
                  typeof m.recordingUrl === "string" ? m.recordingUrl : null;
                const duration =
                  typeof m.durationSeconds === "number" ? m.durationSeconds : null;
                return (
                  <li key={String(m.id)} className="rounded border border-border px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {String(m.fromE164 || "unknown")} · {m.isRead ? "read" : "unread"}
                        {duration != null ? ` · ${duration}s` : ""}
                      </span>
                      {!m.isRead ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await fetch("/api/phone/voicemail", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "mark_read",
                                messageId: m.id,
                              }),
                            });
                            const j = await fetch("/api/phone/voicemail").then((r) => r.json());
                            setMessages(j.data?.messages || []);
                          }}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                    {recordingUrl ? (
                      <audio
                        className="mt-2 w-full"
                        controls
                        preload="none"
                        src={`/api/phone/voicemail/${m.id}/recording`}
                      />
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Recording not available yet (waiting for carrier upload).
                      </p>
                    )}
                    {m.transcriptText ? (
                      <p className="mt-2 text-muted-foreground">
                        Transcript: {String(m.transcriptText)}
                      </p>
                    ) : recordingUrl ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Transcript pending — transcription runs when the recording is saved
                        {boxes.some((b) => b.transcriptionEnabled !== false)
                          ? " (Whisper when OPENAI_API_KEY is set)."
                          : "."}
                      </p>
                    ) : null}
                  </li>
                );
              })}
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
          <CardTitle>Softphone user settings</CardTitle>
          <p className="text-xs text-muted-foreground">
            Anyone can save their own cellular, ring, DND, and screening. Phone admins can edit
            teammates and the full permission ACL.
          </p>
          {isPhoneAdmin && members.length > 0 ? (
            <div>
              <Label>Teammate</Label>
              <select
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={editUserId || meUserId}
                onChange={(e) => selectEditUser(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.userId === meUserId ? `You (${m.role})` : `${m.userId.slice(0, 8)}… (${m.role})`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
          <div>
            <Label>Your default caller ID</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              value={defaultCallerIdUser}
              onChange={(e) => setDefaultCallerIdUser(e.target.value)}
            >
              <option value="">Workspace default</option>
              {phoneNumbers.map((n) => (
                <option key={n.id} value={n.number}>
                  {n.number}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dnd} onChange={(e) => setDnd(e.target.checked)} />
            Do not disturb
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={intl} onChange={(e) => setIntl(e.target.checked)} />
            International calling enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={recordingEnabled}
              onChange={(e) => setRecordingEnabled(e.target.checked)}
            />
            Call recording allowed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ringMobile}
              onChange={(e) => setRingMobile(e.target.checked)}
            />
            Ring my cellular on queue / inbound
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ringDesktop}
              onChange={(e) => setRingDesktop(e.target.checked)}
            />
            Ring browser / desktop softphone (web push)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={screening}
              onChange={(e) => setScreening(e.target.checked)}
            />
            Caller screening (softphone Accept/Decline or press 1 on cell)
          </label>
          {isPhoneAdmin ? (
            <div className="rounded border border-border p-3 space-y-2">
              <p className="text-sm font-medium">Softphone permissions (admin)</p>
              {(
                [
                  ["Record", aclRecord, setAclRecord],
                  ["Transfer", aclTransfer, setAclTransfer],
                  ["Park", aclPark, setAclPark],
                  ["Conference", aclConference, setAclConference],
                  ["Flip", aclFlip, setAclFlip],
                  ["Merge", aclMerge, setAclMerge],
                  ["Place call", aclPlaceCall, setAclPlaceCall],
                  ["Block caller", aclBlockCaller, setAclBlockCaller],
                  ["Listen / barge", aclListen, setAclListen],
                  ["Whisper / coach", aclWhisper, setAclWhisper],
                  ["International", aclInternational, setAclInternational],
                  ["Anonymous dial", aclAnonymous, setAclAnonymous],
                ] as Array<[string, boolean, (v: boolean) => void]>
              ).map(([label, checked, set]) => (
                <label key={label} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => set(e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Permission ACL is managed by a phone admin. You can still update cellular, ring, and
              screening below.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            These settings drive softphone dial, queue cellular ring, push, screening, and ACL.
          </p>
          <Button onClick={saveAdmin} disabled={saving}>
            Save phone settings
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
