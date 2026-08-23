"use client";

import {
  parseVoicemailApiPayload,
  type PersonalVoicemailBox,
  type PersonalVoicemailMessage,
} from "@/lib/personal/voicemail-mappers";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_VOICEMAIL_ACTIVITY,
  WIREFRAME_VOICEMAIL_FORWARDING,
  WIREFRAME_VOICEMAIL_GREETINGS,
  WIREFRAME_VOICEMAIL_KPIS,
  WIREFRAME_VOICEMAIL_MESSAGES,
  WIREFRAME_VOICEMAIL_STORAGE,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import {
  AudioLines,
  Ban,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Download,
  Infinity,
  Mail,
  Mic,
  MoreHorizontal,
  Pencil,
  Phone,
  PhoneCall,
  Play,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatPhone } from "@/lib/utils";
import { PersonalGreetingControls } from "./personal-greeting-controls";
import { PersonalNumberSelector } from "./personal-number-selector";
import {
  PersonalMockBtn,
  PersonalMockFilterChips,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPagination,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockSelect,
  PersonalMockToggle,
  pm,
} from "./mockup/primitives";
import { PersonalServiceSubscribeBanner } from "./personal-service-subscribe-banner";

type VmMessage = {
  id: string;
  callerNumber: string;
  callerName?: string;
  calledNumber?: string;
  calledLabel?: string;
  durationSec: number;
  transcript?: string;
  summary?: string;
  internalNotes?: string;
  readAt: string | null;
  createdAt: string;
  isDemo: boolean;
  avatarTone?: "blue" | "purple" | "orange" | "green" | "pink";
};

const AVATAR_TONE_CLASSES = {
  blue: "bg-[#eff6ff] text-[#2563eb]",
  purple: "bg-[#f5f3ff] text-[#7c3aed]",
  orange: "bg-[#fff7ed] text-[#ea580c]",
  green: "bg-[#ecfdf5] text-[#059669]",
  pink: "bg-[#fdf2f8] text-[#db2777]",
} as const;

function avatarToneClass(
  tone?: VmMessage["avatarTone"],
  fallbackIndex = 0,
): string {
  const keys = Object.keys(AVATAR_TONE_CLASSES) as Array<keyof typeof AVATAR_TONE_CLASSES>;
  const key = tone || keys[fallbackIndex % keys.length];
  return AVATAR_TONE_CLASSES[key];
}

function callerAvatarInitials(name?: string | null, number?: string | null): string {
  const trimmed = (name || "").trim();
  if (trimmed && trimmed.toLowerCase() !== "unknown") {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  const digits = (number || "").replace(/\D/g, "");
  if (digits.length >= 2) return digits.slice(-2);
  return "?";
}

function callerDisplayName(name?: string | null, number?: string | null): string {
  const trimmed = (name || "").trim();
  if (trimmed && trimmed.toLowerCase() !== "unknown") return trimmed;
  return formatPhone(number || "Unknown");
}

function relativeVmDate(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (d >= startToday) return "Today";
  if (d >= startYesterday) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatVmTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDurationLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
  const [playSpeed, setPlaySpeed] = useState(1);
  const [voicemailEnabled, setVoicemailEnabled] = useState(true);
  const [autoTranscription, setAutoTranscription] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [forwardEmail, setForwardEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"All" | "Unread" | "Read">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxPage, setInboxPage] = useState(1);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showGreetingEditor, setShowGreetingEditor] = useState(false);
  const greetingRef = useRef<HTMLDivElement>(null);
  const greetingPreviewRef = useRef<HTMLAudioElement>(null);

  async function ensureVoicemailBoxId(): Promise<string | undefined> {
    if (numberId) {
      const res = await fetch("/api/phone/voicemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_number_box", phoneNumberId: numberId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Could not create voicemail box for this number.");
      }
      return json.data?.id as string | undefined;
    }
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_personal", name: "Personal voicemail" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || "Could not create voicemail box.");
    }
    return json.data?.id as string | undefined;
  }

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

  const useWireframe = usePersonalWireframe(messages.length);
  const managingNumberId = useWireframe
    ? numberId || numbers[0]?.id
    : numberId;

  useEffect(() => {
    if (useWireframe && !selectedId && WIREFRAME_VOICEMAIL_MESSAGES[0]) {
      setSelectedId(WIREFRAME_VOICEMAIL_MESSAGES[0].id);
    }
  }, [useWireframe, selectedId]);

  useEffect(() => {
    setInboxPage(1);
  }, [inboxFilter, searchQuery, numberId]);

  const sourceMessages: VmMessage[] = useWireframe
    ? WIREFRAME_VOICEMAIL_MESSAGES.map((m) => ({
        id: m.id,
        callerNumber: m.callerNumber,
        callerName: m.callerName,
        calledNumber: m.calledNumber,
        calledLabel: m.calledLabel,
        durationSec: m.durationSec,
        transcript: m.transcript,
        summary: m.summary,
        readAt: m.readAt,
        createdAt: m.createdAt,
        isDemo: true,
        avatarTone: m.avatarTone,
      }))
    : messages.map((m) => ({
        id: m.id,
        callerNumber: m.callerNumber,
        callerName: undefined,
        calledNumber: numberId
          ? numbers.find((n) => n.id === numberId)?.number
          : numbers[0]?.number,
        calledLabel: numberId
          ? numbers.find((n) => n.id === numberId)?.friendlyName
          : numbers[0]?.friendlyName,
        durationSec: m.durationSec,
        transcript: m.transcript ?? undefined,
        summary: m.transcript
          ? m.transcript.replace(/\s+/g, " ").trim().slice(0, 160)
          : undefined,
        internalNotes: m.internalNotes ?? undefined,
        readAt: m.readAt ?? null,
        createdAt: m.createdAt,
        isDemo: false,
      }));

  const unread = sourceMessages.filter((m) => !m.readAt).length;
  const voicemailMinutes = useWireframe
    ? WIREFRAME_VOICEMAIL_KPIS.minutes
    : Math.round(messages.reduce((sum, m) => sum + (m.durationSec || 0), 0) / 60);
  const selected =
    sourceMessages.find((m) => m.id === selectedId) ?? sourceMessages[0] ?? null;

  const filteredMessages = useMemo(() => {
    return sourceMessages.filter((m) => {
      if (inboxFilter === "Unread" && m.readAt) return false;
      if (inboxFilter === "Read" && !m.readAt) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (m.callerNumber || "").includes(q) ||
        (m.callerName || "").toLowerCase().includes(q) ||
        (m.transcript || "").toLowerCase().includes(q)
      );
    });
  }, [sourceMessages, inboxFilter, searchQuery]);

  const inboxPerPage = 5;
  const inboxTotal = useWireframe ? WIREFRAME_VOICEMAIL_KPIS.total : filteredMessages.length;
  const inboxPages = useWireframe ? 9 : Math.max(1, Math.ceil(inboxTotal / inboxPerPage));
  const pagedMessages = useWireframe
    ? filteredMessages.slice(0, inboxPerPage)
    : filteredMessages.slice((inboxPage - 1) * inboxPerPage, inboxPage * inboxPerPage);

  const greetingLibrary = useWireframe
    ? WIREFRAME_VOICEMAIL_GREETINGS
    : [
        {
          id: "default",
          label: "Default greeting",
          status: "Inactive" as const,
          durationSec: 0,
          updated: "—",
        },
        ...(box?.greetingText
          ? [
              {
                id: "text",
                label: "Personal greeting",
                status: "Active" as const,
                durationSec: 0,
                updated: "—",
              },
            ]
          : []),
        ...(box?.greetingUrl
          ? [
              {
                id: "audio",
                label: "Custom audio greeting",
                status: "Active" as const,
                durationSec: 0,
                updated: "—",
              },
            ]
          : []),
      ];

  async function markRead(messageId: string) {
    if (sourceMessages.find((m) => m.id === messageId)?.isDemo) {
      return;
    }
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
    if (sourceMessages.find((m) => m.id === messageId)?.isDemo) return;
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
        boxId = await ensureVoicemailBoxId();
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
          voicemailEnabled ? "enable_voicemail" : "disable_voicemail",
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
    let boxId = box?.id;
    if (!boxId) {
      boxId = await ensureVoicemailBoxId();
    }
    if (!boxId) {
      throw new Error("Could not resolve voicemail box for this number.");
    }
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_box",
        boxId,
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

  const managedNumber = numbers.find((n) => n.id === numberId) ?? numbers[0];
  const managedSettings =
    managedNumber?.settingsJson && typeof managedNumber.settingsJson === "object"
      ? (managedNumber.settingsJson as Record<string, unknown>)
      : {};
  const forwardRingSeconds =
    typeof managedSettings.forwardRingSeconds === "number"
      ? managedSettings.forwardRingSeconds
      : 20;
  const forwardingEnabledLive = Boolean(managedNumber?.voiceForwardTo);

  function openGreetingEditor() {
    setShowGreetingEditor(true);
    greetingRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function previewGreeting() {
    const url = box?.greetingUrl;
    if (!url) {
      setSettingsMessage("Record or upload a greeting first.");
      return;
    }
    const audio = greetingPreviewRef.current;
    if (!audio) return;
    audio.src = url;
    audio.play().catch(() => setSettingsMessage("Could not play greeting audio."));
  }

  const settingsSidebar = (
    <div className="space-y-4">
      <audio ref={greetingPreviewRef} className="hidden" />
      <div className={pm.card + " space-y-3 p-4"}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-[#111827]">Voicemail Greeting</h3>
          <PersonalMockPill tone="green">Active</PersonalMockPill>
        </div>
        <p className="text-[13px] font-semibold text-[#111827]">
          {useWireframe ? "Main Line Greeting" : box?.greetingUrl ? "Custom audio greeting" : "Personal greeting"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <PersonalMockBtn variant="outline" className="text-[12px]" onClick={previewGreeting}>
            Preview Greeting
          </PersonalMockBtn>
          <PersonalMockBtn variant="outline" className="text-[12px]" onClick={openGreetingEditor}>
            Change Greeting
          </PersonalMockBtn>
          <PersonalMockBtn variant="outline" className="text-[12px]" onClick={openGreetingEditor}>
            Record
          </PersonalMockBtn>
          <PersonalMockBtn
            variant="outline"
            className="gap-1 text-[12px]"
            onClick={openGreetingEditor}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </PersonalMockBtn>
        </div>
        <PersonalMockBtn
          variant="outline"
          className="mt-2 w-full gap-1 text-[12px]"
          onClick={openGreetingEditor}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Generate
        </PersonalMockBtn>
      </div>

      <div className={pm.card + " space-y-4 p-4"}>
        <h3 className="text-[15px] font-semibold text-[#111827]">Voicemail Settings</h3>
        <PersonalMockToggle
          label="Voicemail Enabled"
          checked={voicemailEnabled}
          onChange={setVoicemailEnabled}
        />
        <PersonalMockToggle
          label="Auto-Transcription"
          checked={autoTranscription}
          onChange={setAutoTranscription}
        />
        <PersonalMockToggle label="Email Alerts" checked={emailAlerts} onChange={setEmailAlerts} />
        <div>
          <label className="text-[12px] font-medium text-[#6b7280]">Primary Email</label>
          <PersonalMockInput
            className="mt-1"
            placeholder="you@email.com"
            value={forwardEmail}
            onChange={(e) => setForwardEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="text-[12px] font-medium text-[#6b7280]">
            Secondary Email (optional)
          </label>
          <PersonalMockInput
            className="mt-1"
            placeholder="optional@email.com"
            value={secondaryEmail}
            onChange={(e) => setSecondaryEmail(e.target.value)}
          />
        </div>
        <p className="text-[11px] text-[#9ca3af]">
          Email alerts include a recording link and transcript when auto-transcription is on.
        </p>
      </div>

      <div className={pm.card + " space-y-2 p-4 text-[12px]"}>
        <h3 className="text-[15px] font-semibold text-[#111827]">How Calls Reach This Voicemail</h3>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Forwarding</span>
          <span className="font-medium text-[#111827]">
            {useWireframe
              ? WIREFRAME_VOICEMAIL_FORWARDING.forwardingEnabled
                ? "Enabled"
                : "Disabled"
              : forwardingEnabledLive
                ? "Enabled"
                : "Disabled"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Ring time</span>
          <span className="font-medium text-[#111827]">
            {useWireframe
              ? `${WIREFRAME_VOICEMAIL_FORWARDING.ringSeconds} seconds`
              : `${forwardRingSeconds} seconds`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Direct to voicemail</span>
          <span className="font-medium text-[#111827]">Off</span>
        </div>
        <Link
          href="/personal/forwarding"
          className="mt-2 block text-[12px] font-semibold text-[#6366f1]"
        >
          Open Forwarding Settings &gt;
        </Link>
      </div>

      <div className={pm.card + " space-y-2 p-4 text-[12px]"}>
        <h3 className="text-[15px] font-semibold text-[#111827]">Storage &amp; Usage</h3>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Messages Stored</span>
          <span className="font-medium text-[#111827]">
            {useWireframe ? WIREFRAME_VOICEMAIL_STORAGE.messagesStored : messages.length}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Audio Stored</span>
          <span className="font-medium text-[#111827]">
            {useWireframe ? `${WIREFRAME_VOICEMAIL_STORAGE.audioMb} MB` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Transcripts</span>
          <span className="font-medium text-[#111827]">
            {useWireframe ? WIREFRAME_VOICEMAIL_STORAGE.transcripts : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#6b7280]">Retention</span>
          <span className="font-medium text-[#111827]">
            {useWireframe ? `${WIREFRAME_VOICEMAIL_STORAGE.retentionDays} days` : "90 days"}
          </span>
        </div>
        <Link href="/settings/billing" className="mt-2 block text-[12px] font-semibold text-[#6366f1]">
          Manage Storage &gt;
        </Link>
      </div>

      <PersonalMockBtn className="w-full" disabled={savingSettings} onClick={saveSettings}>
        {savingSettings ? "Saving…" : "Save Settings"}
      </PersonalMockBtn>
      {settingsMessage ? (
        <p className="text-center text-[12px] text-[#6b7280]">{settingsMessage}</p>
      ) : null}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-[#6366f1]"
        onClick={() => {
          if (!managedNumber?.number) {
            setSettingsMessage("Add a number before testing voicemail.");
            return;
          }
          setSettingsMessage(
            `Call ${formatPhone(managedNumber.number)} from another phone. If forwarding is on, let it ring through to voicemail.`,
          );
        }}
      >
        <Phone className="h-3.5 w-3.5" />
        Test Voicemail
      </button>
    </div>
  );

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Voicemail"
        description="Manage messages, greetings, transcription, and voicemail delivery for each of your numbers."
        actions={
          <>
            <PersonalMockBtn
              variant="outline"
              className="gap-1.5"
              onClick={() => setShowGreetingEditor(true)}
            >
              <Mic className="h-4 w-4" />
              Create Greeting
            </PersonalMockBtn>
            <PersonalMockBtn
              className="gap-1.5"
              onClick={() => {
                setShowGreetingEditor(true);
                greetingRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Circle className="h-3.5 w-3.5 fill-current" />
              Record Greeting
            </PersonalMockBtn>
          </>
        }
        filters={
          numbers.length > 0 ? (
            <div className={pm.card + " px-4 py-3"}>
              <label className="text-[12px] font-semibold text-[#374151]">Managing Number</label>
              <div className="mt-2">
                <PersonalNumberSelector
                  numbers={numbers}
                  selectedId={managingNumberId}
                  label=""
                  allowAll={!useWireframe}
                  selectClassName="h-10 w-full min-w-0 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px] font-semibold text-[#111827]"
                />
              </div>
              {managingNumberId ? (
                <div className="mt-3">
                  <PersonalServiceSubscribeBanner
                    phoneNumberId={managingNumberId}
                    service="voicemail"
                  />
                </div>
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PersonalMockKpi
          label="Total Voicemails"
          value={useWireframe ? WIREFRAME_VOICEMAIL_KPIS.total : messages.length}
          sub="All time"
          icon={Infinity}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Unread"
          value={useWireframe ? WIREFRAME_VOICEMAIL_KPIS.unread : unread}
          sub="Needs attention"
          icon={Mail}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Voicemail Minutes"
          value={`${voicemailMinutes} min`}
          sub="This month"
          icon={Clock}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalMockKpi
          label="Transcription"
          value={autoTranscription ? "On" : "Off"}
          sub="Auto-transcription"
          icon={AudioLines}
          iconClass={
            autoTranscription ? "bg-[#ecfdf5] text-[#059669]" : "bg-[#f3f4f6] text-[#6b7280]"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="space-y-4 xl:col-start-1">
        <PersonalMockSection title="Inbox" className="xl:max-h-[520px] xl:overflow-y-auto">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
            <PersonalMockInput
              className="pl-9"
              placeholder="Search caller or transcript"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <PersonalMockFilterChips
              options={["All", "Unread", "Read"]}
              active={inboxFilter}
              onChange={(v) => setInboxFilter(v as typeof inboxFilter)}
            />
            <PersonalMockSelect className="h-8 w-[120px] shrink-0 text-[12px]">
              <option>Newest First</option>
              <option>Oldest First</option>
            </PersonalMockSelect>
          </div>
          {loading && !useWireframe ? (
            <p className={pm.muted}>Loading voicemail…</p>
          ) : pagedMessages.length === 0 ? (
            <p className={pm.muted}>No voicemails yet.</p>
          ) : (
            <>
              <ul className="divide-y divide-[#f3f4f6]">
                {pagedMessages.map((m, idx) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(m.id);
                        if (!m.readAt && !m.isDemo) markRead(m.id);
                      }}
                      className={cn(
                        "w-full border-l-4 px-2 py-3 text-left transition hover:bg-[#f9fafb]",
                        selectedId === m.id
                          ? "border-l-[#6366f1] bg-[#eef2ff]"
                          : "border-l-transparent",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            avatarToneClass(m.avatarTone, idx),
                          )}
                        >
                          {callerAvatarInitials(m.callerName, m.callerNumber)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[13px] font-semibold text-[#111827]">
                              {callerDisplayName(m.callerName, m.callerNumber)}
                            </p>
                            {!m.readAt ? (
                              <PersonalMockPill tone="purple">Unread</PersonalMockPill>
                            ) : (
                              <PersonalMockPill tone="gray">Read</PersonalMockPill>
                            )}
                          </div>
                          <p className="text-[12px] text-[#6b7280]">
                            {formatPhone(m.callerNumber || "Unknown")}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[#9ca3af]">
                            <span>
                              {relativeVmDate(m.createdAt)} · {formatVmTime(m.createdAt)}
                            </span>
                            <span>{formatDurationLabel(m.durationSec)}</span>
                          </div>
                          {m.transcript ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-[#6b7280]">
                              {m.transcript}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1 self-center">
                          <span className="rounded p-1 text-[#9ca3af]">
                            <Play className="h-3.5 w-3.5" />
                          </span>
                          <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <PersonalMockPagination
                showing={
                  useWireframe
                    ? `Showing 1 to 5 of ${WIREFRAME_VOICEMAIL_KPIS.total} voicemails`
                    : `Showing ${(inboxPage - 1) * inboxPerPage + 1} to ${Math.min(
                        inboxPage * inboxPerPage,
                        filteredMessages.length,
                      )} of ${filteredMessages.length} voicemails`
                }
                total={inboxTotal}
                page={inboxPage}
                pages={inboxPages}
                pageSizeLabel="5 / page"
                onPageChange={setInboxPage}
              />
            </>
          )}
        </PersonalMockSection>

        <div ref={greetingRef}>
        <PersonalMockSection
          title="Greeting Library"
          action={
            <PersonalMockBtn variant="outline" className="h-8 gap-1 text-[12px]">
              <Mic className="h-3.5 w-3.5" />
              Add Greeting
            </PersonalMockBtn>
          }
        >
          <ul className="space-y-2">
            {greetingLibrary.map((g) => (
              <li
                key={g.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                  g.status === "Active" ? "border-[#c7d2fe] bg-[#eef2ff]" : "border-[#f3f4f6]",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#111827]">{g.label}</p>
                    {g.status === "Active" ? (
                      <PersonalMockPill tone="green">Active</PersonalMockPill>
                    ) : (
                      <PersonalMockPill tone="gray">Inactive</PersonalMockPill>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#6b7280]">
                    {g.durationSec > 0 ? `${g.durationSec}s · ` : ""}Updated {g.updated}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className="rounded p-1.5 hover:bg-white">
                    <Play className="h-3.5 w-3.5 text-[#6b7280]" />
                  </button>
                  <button type="button" className="rounded p-1.5 hover:bg-white">
                    <Pencil className="h-3.5 w-3.5 text-[#6b7280]" />
                  </button>
                  <button type="button" className="rounded p-1.5 hover:bg-white">
                    <MoreHorizontal className="h-3.5 w-3.5 text-[#6b7280]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {showGreetingEditor ? (
            <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
              <PersonalGreetingControls
                greetingText={box?.greetingText || "Please leave a message after the tone."}
                greetingUrl={box?.greetingUrl}
                onSaveText={saveGreetingText}
                onSaveUrl={saveGreetingUrl}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <PersonalMockBtn
                  variant="outline"
                  onClick={() =>
                    persistGreeting({ greetingText: "Please leave a message after the tone." })
                  }
                >
                  Use default greeting
                </PersonalMockBtn>
                <PersonalMockBtn variant="ghost" onClick={() => setShowGreetingEditor(false)}>
                  Close
                </PersonalMockBtn>
              </div>
            </div>
          ) : null}
        </PersonalMockSection>
        </div>
        </div>

        <div className="space-y-4 xl:col-start-2">
        <PersonalMockSection title="Voicemail message" hideHeader className="min-h-[400px]">
          {!selected ? (
            <p className={pm.muted}>Select a voicemail to listen and read the transcript.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[18px] font-bold",
                    avatarToneClass(selected.avatarTone),
                  )}
                >
                  {callerAvatarInitials(selected.callerName, selected.callerNumber)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[16px] font-semibold text-[#111827]">
                      {callerDisplayName(selected.callerName, selected.callerNumber)}
                    </p>
                    {!selected.readAt ? (
                      <PersonalMockPill tone="purple">Unread</PersonalMockPill>
                    ) : (
                      <PersonalMockPill tone="gray">Read</PersonalMockPill>
                    )}
                  </div>
                  <p className="text-[12px] text-[#6b7280]">
                    {formatPhone(selected.callerNumber || "Unknown")}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-[12px]">
                <div>
                  <p className="text-[#6b7280]">Called Number</p>
                  <p className="mt-0.5 font-semibold text-[#111827]">
                    {formatPhone(selected.calledNumber || numbers[0]?.number || "—")}
                  </p>
                  {selected.calledLabel ? (
                    <p className="text-[11px] text-[#6b7280]">{selected.calledLabel}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[#6b7280]">Received</p>
                  <p className="mt-0.5 font-semibold text-[#111827]">
                    {new Date(selected.createdAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    at {formatVmTime(selected.createdAt)}
                  </p>
                  <p className="text-[11px] text-[#6b7280]">
                    Duration {formatDurationLabel(selected.durationSec)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6366f1] text-white"
                    onClick={() =>
                      setPlayingId(playingId === selected.id ? null : selected.id)
                    }
                  >
                    {playingId === selected.id ? "■" : "▶"}
                  </button>
                  {playingId === selected.id && !selected.isDemo ? (
                    <audio
                      controls
                      autoPlay
                      className="flex-1"
                      src={`/api/phone/voicemail/${selected.id}/recording`}
                    />
                  ) : (
                    <div className="flex flex-1 items-end gap-0.5">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-1 rounded-full bg-[#6366f1]/70"
                          style={{ height: `${8 + ((i * 7) % 28)}px` }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#6b7280]">
                    <span>0:00 / {formatDurationLabel(selected.durationSec)}</span>
                    <button
                      type="button"
                      className="rounded border border-[#e5e7eb] px-1.5 py-0.5 text-[10px] font-semibold"
                      onClick={() =>
                        setPlaySpeed((s) => (s >= 2 ? 1 : s + 0.5))
                      }
                    >
                      {playSpeed}x
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold text-[#111827]">Transcript</p>
                {selected.transcript ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-[#374151]">
                    {selected.transcript}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] text-[#9ca3af]">Transcription not available.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <ActionBtn icon={PhoneCall} label="Call Back" href={`tel:${selected.callerNumber}`} />
                <ActionBtn
                  icon={Check}
                  label="Mark Read"
                  onClick={() => markRead(selected.id)}
                />
                <ActionBtn
                  icon={Download}
                  label="Download"
                  href={selected.isDemo ? undefined : `/api/phone/voicemail/${selected.id}/recording`}
                  external
                />
                <ActionBtn
                  icon={Ban}
                  label="Block Caller"
                  tone="danger"
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
                  icon={AudioLines}
                  label="Retranscribe"
                  onClick={async () => {
                    if (selected.isDemo) return;
                    await fetch("/api/phone/voicemail", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "retranscribe", messageId: selected.id }),
                    });
                    await loadVoicemail();
                  }}
                />
                <ActionBtn
                  icon={Trash2}
                  label="Delete"
                  tone="danger"
                  onClick={() => deleteMessage(selected.id)}
                />
              </div>

              <div className="rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-4">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#111827]">
                  <Sparkles className="h-4 w-4 text-[#6366f1]" />
                  Message Summary
                </p>
                <p className="mt-2 text-[13px] text-[#374151]">
                  {selected.summary ||
                    selected.transcript?.slice(0, 120) ||
                    "No summary available."}
                </p>
                <button type="button" className="mt-2 text-[12px] font-semibold text-[#6366f1]">
                  Suggested action: Call back
                </button>
              </div>

              {!selected.isDemo ? (
                <div className="rounded-lg border border-[#e5e7eb] p-4">
                  <p className="text-[12px] font-semibold text-[#111827]">Internal notes</p>
                  <textarea
                    className="mt-2 min-h-[80px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
                    value={selected.internalNotes ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === selected.id ? { ...m, internalNotes: value } : m,
                        ),
                      );
                    }}
                    onBlur={async (e) => {
                      await fetch("/api/phone/voicemail", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "update_message_notes",
                          messageId: selected.id,
                          internalNotes: e.target.value,
                        }),
                      });
                    }}
                    placeholder="Team notes about this voicemail…"
                  />
                </div>
              ) : null}
            </div>
          )}
        </PersonalMockSection>

        <PersonalMockSection
          title="Recent Voicemail Activity"
          action={
            <button type="button" className="text-[12px] font-semibold text-[#6366f1]">
              View all
            </button>
          }
        >
          {useWireframe ? (
            <ul className="space-y-3">
              {WIREFRAME_VOICEMAIL_ACTIVITY.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-[13px]">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      a.icon === "mic" && "bg-[#eef2ff] text-[#6366f1]",
                      a.icon === "waveform" && "bg-[#ecfdf5] text-[#059669]",
                      a.icon === "mail" && "bg-[#fff7ed] text-[#ea580c]",
                    )}
                  >
                    {a.icon === "mic" ? (
                      <Mic className="h-4 w-4" />
                    ) : a.icon === "waveform" ? (
                      <AudioLines className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#111827]">{a.text}</p>
                    <p className="text-[12px] text-[#6b7280]">{a.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#9ca3af]">{a.time}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2 text-[13px] text-[#6b7280]">
              {messages.slice(0, 5).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 border-b border-[#f3f4f6] pb-2"
                >
                  <span>Voicemail from {formatPhone(m.callerNumber || "Unknown")}</span>
                  <span className="shrink-0 text-[11px]">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
              {messages.length === 0 ? <li>No recent voicemail activity.</li> : null}
            </ul>
          )}
        </PersonalMockSection>
        </div>

        <div className="xl:col-start-3 xl:row-span-2">{settingsSidebar}</div>
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
  const className = cn(
    "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-[11px] font-semibold",
    tone === "danger"
      ? "border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2]"
      : "border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb]",
  );
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
    <button type="button" className={className} onClick={onClick} disabled={!onClick}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
