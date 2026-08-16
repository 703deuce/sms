"use client";

import {
  parseVoicemailApiPayload,
  type PersonalVoicemailBox,
  type PersonalVoicemailMessage,
} from "@/lib/personal/voicemail-mappers";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import {
  Archive,
  Cloud,
  Folder,
  Mic,
  Phone,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, Fragment } from "react";
import { formatPhone } from "@/lib/utils";
import {
  PersonalAsideCard,
  PersonalOutlineButton,
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  PersonalStatCard,
  PersonalStatusBadge,
  pCard,
  pMuted,
} from "./personal-ui";
import { PersonalGreetingControls } from "./personal-greeting-controls";

export function PersonalVoicemailUI({ numberId }: { numberId?: string }) {
  const [messages, setMessages] = useState<PersonalVoicemailMessage[]>([]);
  const [box, setBox] = useState<PersonalVoicemailBox | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [autoTranscription, setAutoTranscription] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [forwardEmail, setForwardEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread" | "read">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadVoicemail = useCallback(async () => {
    const res = await fetch("/api/phone/voicemail");
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
    if (rows[0]) setExpandedId((cur) => cur ?? rows[0].id);
  }, []);

  useEffect(() => {
    loadVoicemail().finally(() => setLoading(false));
  }, [loadVoicemail, numberId]);

  const unread = messages.filter((m) => !m.readAt).length;
  const totalGreetings = box?.greetingUrl ? 2 : box?.greetingText ? 1 : 0;

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
    if (expandedId === messageId) setExpandedId(null);
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

  return (
    <PersonalPageWrap
      aside={
        <>
          <PersonalAsideCard title="How to use Voicemail">
            <ul className="space-y-3">
              {[
                "Callers hear your greeting when you can’t answer.",
                "Messages appear here with optional transcription.",
                "Forward important voicemails to your email.",
              ].map((text) => (
                <li key={text} className="flex gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </PersonalAsideCard>
          <PersonalAsideCard title="Quick Tips">
            <p>Keep greetings short and mention when you&apos;ll call back.</p>
            <p className="mt-2">Turn on email alerts so you never miss an important message.</p>
          </PersonalAsideCard>
          <div className={pCard + " p-4 text-center"}>
            <p className="text-[13px] font-semibold text-[#111827]">Storage</p>
            <div className="mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#6366f1] text-[14px] font-bold text-[#6366f1]">
              {Math.min(100, Math.round((messages.length / 20) * 100))}%
            </div>
            <p className="mt-2 text-[12px] text-[#6b7280]">{messages.length} messages stored</p>
            <Link href="/settings/billing" className="mt-2 text-[12px] font-semibold text-[#6366f1]">
              Upgrade to Pro
            </Link>
          </div>
        </>
      }
    >
      <PersonalPageHeader
        title="Voicemail"
        description="Your call destination when you can't answer — inside Transovo, not your carrier."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PersonalStatCard label="Total Voicemails" value={messages.length} icon={Folder} />
        <PersonalStatCard
          label="Unread Messages"
          value={unread}
          icon={Phone}
          iconClass="bg-[#fef2f2] text-[#dc2626]"
        />
        <PersonalStatCard
          label="Storage Used"
          value={`${messages.length}`}
          sub="messages"
          icon={Cloud}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalStatCard
          label="Total Greetings"
          value={totalGreetings || 1}
          icon={Mic}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
      </div>

      <PersonalSection title="Voicemail Inbox">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "unread", "read"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setInboxFilter(f)}
              className={`rounded-lg px-3 py-1 text-[12px] ${
                inboxFilter === f ? "bg-[#6366f1] text-white" : "bg-[#f3f4f6]"
              }`}
            >
              {f === "all" ? "All" : f === "unread" ? "Unread" : "Read"}
            </button>
          ))}
        </div>
        <input
          className="mb-4 h-10 w-full max-w-md rounded-lg border border-[#e5e7eb] px-3 text-[14px]"
          placeholder="Search caller, number, or transcription"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {loading ? (
          <p className={pMuted}>Loading voicemail…</p>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className={pMuted}>No voicemails yet.</p>
            <p className="mt-1 text-[12px] text-[#9ca3af]">
              When someone leaves a message, it will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="pb-3 w-8" />
                  <th className="pb-3 pr-3">Name</th>
                  <th className="pb-3 pr-3">Number</th>
                  <th className="pb-3 pr-3">Date</th>
                  <th className="pb-3 pr-3">Duration</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages
                  .filter((m) => {
                    if (inboxFilter === "unread" && m.readAt) return false;
                    if (inboxFilter === "read" && !m.readAt) return false;
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (m.callerNumber || "").includes(q) ||
                      (m.transcript || "").toLowerCase().includes(q)
                    );
                  })
                  .map((m) => {
                  const expanded = expandedId === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr
                        className="border-b border-[#f3f4f6] cursor-pointer hover:bg-[#f9fafb]"
                        onClick={() => {
                          const next = expanded ? null : m.id;
                          setExpandedId(next);
                          if (next && !m.readAt) markRead(m.id);
                        }}
                      >
                        <td className="py-3">
                          <input
                            type="checkbox"
                            readOnly
                            checked={Boolean(m.readAt)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 pr-3 font-medium text-[#111827]">Caller</td>
                        <td className="py-3 pr-3">{formatPhone(m.callerNumber || "Unknown")}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 pr-3">{m.durationSec}s</td>
                        <td className="py-3 pr-3">
                          <PersonalStatusBadge status={m.readAt ? "neutral" : "new"} />
                        </td>
                        <td className="py-3 text-right text-[#9ca3af]">⋯</td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-[#f9fafb]">
                          <td colSpan={7} className="px-4 py-4">
                            <p className="text-[12px] font-semibold text-[#6b7280]">
                              Transcription: {m.transcript ? "Done" : "Pending"}
                            </p>
                            <div className="mt-3 flex items-center gap-3 rounded-lg bg-white border border-[#e5e7eb] px-4 py-3">
                              <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366f1] text-white"
                                onClick={() =>
                                  setPlayingId(playingId === m.id ? null : m.id)
                                }
                              >
                                {playingId === m.id ? "■" : "▶"}
                              </button>
                              {playingId === m.id ? (
                                <audio
                                  controls
                                  autoPlay
                                  className="flex-1"
                                  src={`/api/phone/voicemail/${m.id}/recording`}
                                />
                              ) : (
                                <div className="flex-1 h-2 rounded-full bg-[#e5e7eb]">
                                  <div className="h-full w-1/3 rounded-full bg-[#6366f1]" />
                                </div>
                              )}
                              <span className="text-[11px] text-[#9ca3af]">
                                0:{String(m.durationSec).padStart(2, "0")}
                              </span>
                            </div>
                            {m.transcript ? (
                              <p className="mt-3 text-[13px] text-[#374151]">{m.transcript}</p>
                            ) : (
                              <p className="mt-3 text-[13px] text-[#9ca3af]">
                                Transcription not available.
                              </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <a href={`tel:${m.callerNumber}`}>
                                <PersonalOutlineButton>Call Back</PersonalOutlineButton>
                              </a>
                              <PersonalOutlineButton
                                className="gap-1.5"
                                onClick={() => markRead(m.id)}
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archive
                              </PersonalOutlineButton>
                              <PersonalOutlineButton
                                className="text-[#dc2626] border-[#fecaca]"
                                onClick={() => deleteMessage(m.id)}
                              >
                                Delete
                              </PersonalOutlineButton>
                              <PersonalOutlineButton
                                onClick={async () => {
                                  if (!m.callerNumber) return;
                                  await fetch("/api/personal/blocked", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ phone: m.callerNumber }),
                                  });
                                }}
                              >
                                Block caller
                              </PersonalOutlineButton>
                              <a
                                href={`/api/phone/voicemail/${m.id}/recording`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] font-semibold text-[#6366f1] px-3 py-2"
                              >
                                Download
                              </a>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PersonalSection>

      <PersonalSection title="Greeting">
        <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
          <p className="text-[13px] font-semibold text-[#111827]">
            {box?.greetingUrl ? "Custom audio greeting" : box?.greetingText ? "Personal greeting" : "Default greeting"}
          </p>
          <PersonalGreetingControls
            greetingText={box?.greetingText || "Please leave a message after the tone."}
            greetingUrl={box?.greetingUrl}
            onSaveText={saveGreetingText}
            onSaveUrl={saveGreetingUrl}
          />
          <div className="mt-3">
            <PersonalOutlineButton onClick={useDefaultGreeting}>Use default greeting</PersonalOutlineButton>
          </div>
        </div>
      </PersonalSection>

      <div className={pCard + " p-5"}>
        <h2 className="text-[15px] font-semibold text-[#111827]">Voicemail Settings</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-[12px] font-medium text-[#6b7280]">
              When forwarding is on, voicemail answers after your ring timeout if you don&apos;t
              pick up. Turn forwarding off and enable direct voicemail to skip ringing your phone.
            </p>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-[13px]">
              <span>Auto-Transcription</span>
              <input
                type="checkbox"
                checked={autoTranscription}
                onChange={(e) => setAutoTranscription(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-[13px]">
              <span>Email Alerts</span>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
              />
            </label>
            <div>
              <label className="text-[12px] font-medium text-[#6b7280]">Primary email</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]"
                placeholder="you@email.com"
                value={forwardEmail}
                onChange={(e) => setForwardEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#6b7280]">Second notification email</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]"
                placeholder="optional@email.com"
                value={secondaryEmail}
                onChange={(e) => setSecondaryEmail(e.target.value)}
              />
            </div>
          </div>
        </div>
        <PersonalPrimaryButton
          className="mt-4"
          disabled={savingSettings}
          onClick={saveSettings}
        >
          {savingSettings ? "Saving…" : "Save Settings"}
        </PersonalPrimaryButton>
        {settingsMessage ? (
          <p className="mt-2 text-[12px] text-[#6b7280]">{settingsMessage}</p>
        ) : null}
      </div>

      <PersonalSection title="Recent Activity">
        <ul className="space-y-2 text-[13px] text-[#6b7280]">
          {messages.slice(0, 3).map((m) => (
            <li key={m.id}>
              New voicemail from {formatPhone(m.callerNumber || "Unknown")} —{" "}
              {new Date(m.createdAt).toLocaleString()}
            </li>
          ))}
          {messages.length === 0 ? <li>No recent voicemail activity.</li> : null}
        </ul>
      </PersonalSection>
    </PersonalPageWrap>
  );
}
