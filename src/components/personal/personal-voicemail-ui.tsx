"use client";

import {
  parseVoicemailApiPayload,
  type PersonalVoicemailBox,
  type PersonalVoicemailMessage,
} from "@/lib/personal/voicemail-mappers";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import {
  Archive,
  Ban,
  Clock,
  Download,
  Mic,
  Phone,
  PhoneCall,
  Search,
  Trash2,
  Voicemail,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPhone } from "@/lib/utils";
import { PersonalMockProgress } from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockFilterChips,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockToggle,
  pm,
} from "./mockup/primitives";
import { PersonalGreetingControls } from "./personal-greeting-controls";
import { PersonalNumberSelector } from "./personal-number-selector";

export function PersonalVoicemailUI({
  numberId,
  numbers = [],
}: {
  numberId?: string;
  numbers?: PersonalNumberRow[];
}) {
  const [messages, setMessages] = useState<PersonalVoicemailMessage[]>([]);
  const [box, setBox] = useState<PersonalVoicemailBox | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [autoTranscription, setAutoTranscription] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [forwardEmail, setForwardEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"All" | "Unread" | "Read">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const greetingRef = useRef<HTMLDivElement>(null);

  const loadVoicemail = useCallback(async () => {
    const params = new URLSearchParams();
    if (numberId) params.set("phoneNumberId", numberId);
    const res = await fetch(`/api/phone/voicemail?${params}`);
    const j = await res.json().catch(() => ({}));
    const { boxes, messages: rows } = parseVoicemailApiPayload(j.data);
    setMessages(rows);
    const primary = boxes[0] ?? null;
    setBox(primary);
    if (primary) {
      setForwardEmail(primary.emailNotify || "");
      setSecondaryEmail(primary.secondaryEmailNotify || "");
      setAutoTranscription(primary.transcriptionEnabled ?? true);
      setEmailAlerts(Boolean(primary.emailNotify));
    }
    setSelectedId((cur) => cur ?? rows[0]?.id ?? null);
  }, [numberId]);

  useEffect(() => {
    loadVoicemail().finally(() => setLoading(false));
  }, [loadVoicemail, numberId]);

  const unread = messages.filter((m) => !m.readAt).length;
  const voicemailMinutes = Math.round(
    messages.reduce((sum, m) => sum + (m.durationSec || 0), 0) / 60,
  );
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (inboxFilter === "Unread" && m.readAt) return false;
      if (inboxFilter === "Read" && !m.readAt) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (m.callerNumber || "").includes(q) ||
        (m.transcript || "").toLowerCase().includes(q)
      );
    });
  }, [messages, inboxFilter, searchQuery]);

  const greetingLibrary = [
    {
      id: "default",
      label: "Default greeting",
      detail: "Please leave a message after the tone.",
      active: !box?.greetingUrl && !box?.greetingText,
    },
    ...(box?.greetingText
      ? [{ id: "text", label: "Personal greeting", detail: box.greetingText, active: !box.greetingUrl }]
      : []),
    ...(box?.greetingUrl
      ? [{ id: "audio", label: "Custom audio greeting", detail: "Recorded or uploaded", active: true }]
      : []),
  ];

  async function markRead(messageId: string) {
    await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", messageId }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, readAt: new Date().toISOString() } : m)),
    );
  }

  async function deleteMessage(messageId: string) {
    if (!window.confirm("Delete this voicemail permanently?")) return;
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_message", messageId }),
    });
    if (!res.ok) return;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (selectedId === messageId) setSelectedId(null);
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      let boxId = box?.id;
      if (!boxId) {
        const ensureRes = await fetch("/api/phone/voicemail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ensure_personal", name: "Personal voicemail" }),
        });
        const ensureJson = await ensureRes.json().catch(() => ({}));
        if (!ensureRes.ok) {
          throw new Error(ensureJson.error || "Could not create voicemail box.");
        }
        boxId = ensureJson.data?.id;
      }

      if (boxId) {
        const updateRes = await fetch("/api/phone/voicemail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_box",
            boxId,
            emailNotify: emailAlerts ? forwardEmail.trim() || null : null,
            secondaryEmailNotify: emailAlerts ? secondaryEmail.trim() || null : null,
            transcriptionEnabled: autoTranscription,
          }),
        });
        const updateJson = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok) {
          throw new Error(updateJson.error || "Could not save voicemail settings.");
        }
      }

      if (numberId) {
        await runPersonalNumberAction(
          numberId,
          emailAlerts ? "enable_voicemail" : "disable_voicemail",
        );
      }

      setSettingsMessage("Settings saved.");
      await loadVoicemail();
    } catch (e) {
      setSettingsMessage(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function persistGreeting(patch: { greetingText?: string; greetingUrl?: string }) {
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: box?.id ? "update_box" : "ensure_personal",
        boxId: box?.id,
        name: "Personal voicemail",
        ...patch,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || "Could not save greeting.");
    }
    await loadVoicemail();
  }

  async function saveGreetingText(text: string) {
    await persistGreeting({ greetingText: text });
  }

  async function saveGreetingUrl(url: string) {
    await persistGreeting({ greetingUrl: url });
  }

  async function useDefaultGreeting() {
    await persistGreeting({ greetingText: "Please leave a message after the tone." });
  }

  const settingsSidebar = (
    <div className={pm.card + " space-y-4 p-4"}>
      <h3 className="text-[15px] font-semibold text-[#111827]">Voicemail Settings</h3>
      <div className="rounded-lg border border-[#f3f4f6] bg-[#fafafa] p-3">
        <p className="text-[12px] font-semibold text-[#374151]">Greeting</p>
        <p className="mt-1 text-[12px] text-[#6b7280]">
          {box?.greetingUrl
            ? "Custom audio greeting"
            : box?.greetingText
              ? "Personal greeting"
              : "Default greeting"}
        </p>
        <PersonalMockBtn
          variant="outline"
          className="mt-2 w-full"
          onClick={() => greetingRef.current?.scrollIntoView({ behavior: "smooth" })}
        >
          Manage greeting
        </PersonalMockBtn>
      </div>
      <PersonalMockToggle
        label="Auto-transcription"
        checked={autoTranscription}
        onChange={setAutoTranscription}
      />
      <PersonalMockToggle
        label="Email alerts"
        checked={emailAlerts}
        onChange={setEmailAlerts}
      />
      <div>
        <label className="text-[12px] font-medium text-[#6b7280]">Primary email</label>
        <PersonalMockInput
          className="mt-1"
          placeholder="you@email.com"
          value={forwardEmail}
          onChange={(e) => setForwardEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="text-[12px] font-medium text-[#6b7280]">Second notification email</label>
        <PersonalMockInput
          className="mt-1"
          placeholder="optional@email.com"
          value={secondaryEmail}
          onChange={(e) => setSecondaryEmail(e.target.value)}
        />
      </div>
      <PersonalMockProgress
        value={messages.length}
        max={100}
        label="Storage"
        sub={`${messages.length} messages stored`}
      />
      <PersonalMockBtn className="w-full" disabled={savingSettings} onClick={saveSettings}>
        {savingSettings ? "Saving…" : "Save Settings"}
      </PersonalMockBtn>
      {settingsMessage ? (
        <p className="text-center text-[12px] text-[#6b7280]">{settingsMessage}</p>
      ) : null}
      <Link href="/settings/billing" className="block text-center text-[12px] font-semibold text-[#6366f1]">
        Upgrade storage
      </Link>
    </div>
  );

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Voicemail"
        description="Your call destination when you can't answer — inside Transovo, not your carrier."
        actions={
          <>
            <PersonalMockBtn onClick={() => greetingRef.current?.scrollIntoView({ behavior: "smooth" })}>
              Create Greeting
            </PersonalMockBtn>
            <PersonalMockBtn
              variant="outline"
              onClick={() => greetingRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              Record Greeting
            </PersonalMockBtn>
          </>
        }
        filters={
          numbers.length > 0 ? (
            <div className={pm.card + " flex flex-wrap items-center gap-3 px-4 py-3"}>
              <span className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                Managing Number
              </span>
              <PersonalNumberSelector numbers={numbers} selectedId={numberId} allowAll />
            </div>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PersonalMockKpi label="Total Voicemails" value={messages.length} icon={Voicemail} />
        <PersonalMockKpi
          label="Unread"
          value={unread}
          icon={Phone}
          iconClass="bg-[#fef2f2] text-[#dc2626]"
        />
        <PersonalMockKpi
          label="Voicemail Minutes"
          value={voicemailMinutes}
          sub="total duration"
          icon={Clock}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalMockKpi
          label="Transcription"
          value={autoTranscription ? "On" : "Off"}
          icon={Mic}
          iconClass={
            autoTranscription ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f3f4f6] text-[#6b7280]"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_300px]">
        <PersonalMockSection title="Inbox" className="xl:max-h-[640px] xl:overflow-y-auto">
          <div className="mb-3">
            <PersonalMockFilterChips
              options={["All", "Unread", "Read"]}
              active={inboxFilter}
              onChange={(v) => setInboxFilter(v as typeof inboxFilter)}
            />
          </div>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <PersonalMockInput
              className="pl-9"
              placeholder="Search caller or transcript"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <p className={pm.muted}>Loading voicemail…</p>
          ) : filteredMessages.length === 0 ? (
            <p className={pm.muted}>No voicemails yet.</p>
          ) : (
            <ul className="divide-y divide-[#f3f4f6]">
              {filteredMessages.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(m.id);
                      if (!m.readAt) markRead(m.id);
                    }}
                    className={`w-full px-1 py-3 text-left transition hover:bg-[#f9fafb] ${
                      selectedId === m.id ? "bg-[#eef2ff]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-[#111827]">Caller</p>
                        <p className="text-[12px] text-[#6b7280]">
                          {formatPhone(m.callerNumber || "Unknown")}
                        </p>
                      </div>
                      {!m.readAt ? <PersonalMockPill tone="blue">New</PersonalMockPill> : null}
                    </div>
                    <p className="mt-1 text-[11px] text-[#9ca3af]">
                      {new Date(m.createdAt).toLocaleString()} · {m.durationSec}s
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PersonalMockSection>

        <PersonalMockSection title="Message Detail" className="min-h-[400px]">
          {!selected ? (
            <p className={pm.muted}>Select a voicemail to listen and read the transcript.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[15px] font-semibold text-[#111827]">
                    {formatPhone(selected.callerNumber || "Unknown")}
                  </p>
                  <p className="text-[12px] text-[#6b7280]">
                    {new Date(selected.createdAt).toLocaleString()} · {selected.durationSec}s
                  </p>
                </div>
                <PersonalMockPill tone={selected.readAt ? "gray" : "blue"}>
                  {selected.readAt ? "Read" : "Unread"}
                </PersonalMockPill>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#6366f1] text-white"
                    onClick={() =>
                      setPlayingId(playingId === selected.id ? null : selected.id)
                    }
                  >
                    {playingId === selected.id ? "■" : "▶"}
                  </button>
                  {playingId === selected.id ? (
                    <audio
                      controls
                      autoPlay
                      className="flex-1"
                      src={`/api/phone/voicemail/${selected.id}/recording`}
                    />
                  ) : (
                    <div className="flex flex-1 items-end gap-0.5">
                      {Array.from({ length: 32 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-1 rounded-full bg-[#6366f1]/70"
                          style={{ height: `${8 + ((i * 7) % 24)}px` }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="text-[11px] text-[#9ca3af]">
                    0:{String(selected.durationSec).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  Transcript
                </p>
                {selected.transcript ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#374151]">
                    {selected.transcript}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-[#9ca3af]">Transcription not available.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <ActionBtn
                  icon={PhoneCall}
                  label="Call Back"
                  href={`tel:${selected.callerNumber}`}
                />
                <ActionBtn
                  icon={Archive}
                  label="Archive"
                  onClick={() => markRead(selected.id)}
                />
                <ActionBtn
                  icon={Download}
                  label="Download"
                  href={`/api/phone/voicemail/${selected.id}/recording`}
                  external
                />
                <ActionBtn
                  icon={Trash2}
                  label="Delete"
                  tone="danger"
                  onClick={() => deleteMessage(selected.id)}
                />
                <ActionBtn
                  icon={Ban}
                  label="Block"
                  onClick={async () => {
                    if (!selected.callerNumber) return;
                    await fetch("/api/personal/blocked", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ phone: selected.callerNumber }),
                    });
                  }}
                />
                <ActionBtn
                  icon={Mic}
                  label="Retranscribe"
                  onClick={async () => {
                    await fetch("/api/phone/voicemail", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "retranscribe", messageId: selected.id }),
                    });
                    await loadVoicemail();
                  }}
                />
              </div>
            </div>
          )}
        </PersonalMockSection>

        {settingsSidebar}
      </div>

      <div ref={greetingRef} className="grid gap-6 lg:grid-cols-2">
        <PersonalMockSection title="Greeting Library">
          <ul className="space-y-2">
            {greetingLibrary.map((g) => (
              <li
                key={g.id}
                className={`rounded-lg border px-3 py-2 text-[13px] ${
                  g.active ? "border-[#c7d2fe] bg-[#eef2ff]" : "border-[#f3f4f6]"
                }`}
              >
                <p className="font-semibold text-[#111827]">{g.label}</p>
                <p className="mt-0.5 text-[12px] text-[#6b7280]">{g.detail}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <PersonalGreetingControls
              greetingText={box?.greetingText || "Please leave a message after the tone."}
              greetingUrl={box?.greetingUrl}
              onSaveText={saveGreetingText}
              onSaveUrl={saveGreetingUrl}
            />
            <PersonalMockBtn variant="outline" className="mt-3" onClick={useDefaultGreeting}>
              Use default greeting
            </PersonalMockBtn>
          </div>
        </PersonalMockSection>

        <PersonalMockSection title="Recent Voicemail Activity">
          <ul className="space-y-2 text-[13px] text-[#6b7280]">
            {messages.slice(0, 5).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 border-b border-[#f3f4f6] pb-2">
                <span>
                  Voicemail from {formatPhone(m.callerNumber || "Unknown")}
                </span>
                <span className="shrink-0 text-[11px]">
                  {new Date(m.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
            {messages.length === 0 ? <li>No recent voicemail activity.</li> : null}
          </ul>
        </PersonalMockSection>
      </div>
    </PersonalMockPage>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  href,
  external,
  tone = "default",
}: {
  icon: typeof Phone;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  tone?: "default" | "danger";
}) {
  const className = `flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-[11px] font-semibold ${
    tone === "danger"
      ? "border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
      : "border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]"
  }`;
  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className={className}
      >
        <Icon className="h-4 w-4" />
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
