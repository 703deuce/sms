"use client";

import { PersonalGreetingControls } from "@/components/personal/personal-greeting-controls";
import { PersonalNumberSelector } from "@/components/personal/personal-number-selector";
import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import { DataTablePaginationFooter } from "@/components/ui/data-table-pagination-footer";
import { Button } from "@/components/ui/button";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  formatVoicemailDetailWhen,
  formatVoicemailDuration,
  formatVoicemailListTime,
  sortVoicemailMessages,
  voicemailPrimaryLine,
  voicemailSecondaryPhoneLine,
  type VoicemailInboxSort,
} from "@/lib/mctb/voicemail-display";
import type { VoicemailInboxSummary } from "@/lib/personal/voicemail-mappers";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import {
  parseVoicemailApiPayload,
  type PersonalVoicemailBox,
  type PersonalVoicemailMessage,
} from "@/lib/personal/voicemail-mappers";
import {
  GLOBAL_TABLE_DEFAULT_PAGE_SIZE,
  type GlobalTablePageSize,
} from "@/lib/ui/global-data-table";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { ChevronLeft, MoreHorizontal, Search, Voicemail } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./mctb-voicemail.css";

type InboxFilter = "All" | "Unread" | "Read";

export function MctbVoicemailWorkspace({
  numbers,
  initialNumberId,
  initialMessageId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
  initialMessageId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<PersonalVoicemailMessage[]>([]);
  const [inboxSummary, setInboxSummary] = useState<VoicemailInboxSummary>({
    totalCount: 0,
    unreadCount: 0,
    minutesThisMonth: 0,
  });
  const [box, setBox] = useState<PersonalVoicemailBox | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initialMessageId ?? null);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxSort, setInboxSort] = useState<VoicemailInboxSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<GlobalTablePageSize>(GLOBAL_TABLE_DEFAULT_PAGE_SIZE);

  const [voicemailEnabled, setVoicemailEnabled] = useState(true);
  const [autoTranscription, setAutoTranscription] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [smsNotifyE164, setSmsNotifyE164] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [vmActionMessage, setVmActionMessage] = useState<string | null>(null);
  const [noteSaveState, setNoteSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [greetingDrawerOpen, setGreetingDrawerOpen] = useState(false);
  const [utilityDrawerOpen, setUtilityDrawerOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const messageAudioRef = useRef<HTMLAudioElement>(null);
  const greetingPreviewRef = useRef<HTMLAudioElement>(null);

  const numberId = searchParams.get("numberId") || initialNumberId || undefined;

  const managedNumber = useMemo(
    () => (numberId ? numbers.find((n) => n.id === numberId) : undefined),
    [numberId, numbers],
  );

  useEffect(() => {
    if (managedNumber) {
      setVoicemailEnabled(managedNumber.voicemailEnabled ?? true);
    }
  }, [managedNumber]);

  const loadVoicemail = useCallback(async () => {
    setLoadError(false);
    const params = new URLSearchParams();
    if (numberId) params.set("phoneNumberId", numberId);
    try {
      const res = await fetch(`/api/phone/voicemail?${params}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("load failed");
      const { boxes, messages: rows, summary } = parseVoicemailApiPayload(j.data);
      setMessages(rows);
      setInboxSummary(summary);
      const primary = boxes[0] ?? null;
      setBox(primary);
      if (primary) {
        setForwardEmail(primary.emailNotify || "");
        setSecondaryEmail(primary.secondaryEmailNotify || "");
        setSmsNotifyE164(primary.smsNotifyE164 || "");
        setAutoTranscription(primary.transcriptionEnabled ?? true);
        setEmailAlerts(Boolean(primary.emailNotify));
        setSmsAlerts(Boolean(primary.smsNotifyE164));
      }
    } catch {
      setLoadError(true);
      setMessages([]);
      setInboxSummary({ totalCount: 0, unreadCount: 0, minutesThisMonth: 0 });
      setBox(null);
    }
  }, [numberId]);

  useEffect(() => {
    setLoading(true);
    loadVoicemail().finally(() => setLoading(false));
  }, [loadVoicemail]);

  useEffect(() => {
    if (!initialMessageId) return;
    if (messages.some((m) => m.id === initialMessageId)) {
      setSelectedId(initialMessageId);
    }
  }, [initialMessageId, messages]);

  useEffect(() => {
    setPage(1);
  }, [inboxFilter, searchQuery, numberId, inboxSort]);

  useEffect(() => {
    if (messageAudioRef.current) {
      messageAudioRef.current.playbackRate = playSpeed;
    }
  }, [playSpeed, selectedId]);

  const sortedMessages = useMemo(
    () => sortVoicemailMessages(messages, inboxSort),
    [messages, inboxSort],
  );

  const filteredMessages = useMemo(() => {
    return sortedMessages.filter((m) => {
      if (inboxFilter === "Unread" && m.isRead) return false;
      if (inboxFilter === "Read" && !m.isRead) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        (m.callerNumber || "").includes(q) ||
        (m.transcript || "").toLowerCase().includes(q) ||
        (m.summary || "").toLowerCase().includes(q)
      );
    });
  }, [sortedMessages, inboxFilter, searchQuery]);

  const total = filteredMessages.length;
  const pagedMessages = filteredMessages.slice((page - 1) * pageSize, page * pageSize);

  const unreadCount = inboxSummary.unreadCount;
  const minutesMonth = inboxSummary.minutesThisMonth;

  const selected = filteredMessages.find((m) => m.id === selectedId) ?? null;

  const forwardRingSeconds =
    managedNumber?.settingsJson &&
    typeof managedNumber.settingsJson === "object" &&
    typeof (managedNumber.settingsJson as Record<string, unknown>).forwardRingSeconds === "number"
      ? (managedNumber.settingsJson as Record<string, number>).forwardRingSeconds
      : 20;
  const forwardingEnabledLive = Boolean(managedNumber?.voiceForwardTo);

  function syncMessageIdInUrl(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("id", id);
    else params.delete("id");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  async function ensureVoicemailBoxId(): Promise<string | undefined> {
    if (numberId) {
      const res = await fetch("/api/phone/voicemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_number_box", phoneNumberId: numberId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not create voicemail box.");
      return json.data?.id as string | undefined;
    }
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_personal", name: "Voicemail" }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not create voicemail box.");
    return json.data?.id as string | undefined;
  }

  async function markRead(messageId: string) {
    const wasUnread = messages.find((m) => m.id === messageId && !m.isRead);
    await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", messageId }),
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m,
      ),
    );
    if (wasUnread) {
      setInboxSummary((s) => ({
        ...s,
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    }
  }

  async function markUnread(messageId: string) {
    const wasRead = messages.find((m) => m.id === messageId && m.isRead);
    await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_unread", messageId }),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isRead: false, readAt: null } : m)),
    );
    if (wasRead) {
      setInboxSummary((s) => ({ ...s, unreadCount: s.unreadCount + 1 }));
    }
  }

  function selectMessage(id: string) {
    setSelectedId(id);
    syncMessageIdInUrl(id);
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.isRead) void markRead(id);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      setMobileDetailOpen(true);
    }
    setOverflowOpen(false);
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
    if (selectedId === messageId) {
      setSelectedId(null);
      syncMessageIdInUrl(null);
    }
  }

  async function saveSettings() {
    if (!numberId) {
      setSettingsMessage("Select a specific number to save voicemail settings.");
      return;
    }
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      let boxId = box?.id;
      if (!boxId) boxId = await ensureVoicemailBoxId();
      if (boxId) {
        const updateRes = await fetch("/api/phone/voicemail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_box",
            boxId,
            emailNotify: emailAlerts ? forwardEmail.trim() || null : null,
            secondaryEmailNotify: emailAlerts ? secondaryEmail.trim() || null : null,
            smsNotifyE164: smsAlerts ? smsNotifyE164.trim() || null : null,
            transcriptionEnabled: autoTranscription,
          }),
        });
        const updateJson = await updateRes.json().catch(() => ({}));
        if (!updateRes.ok) {
          throw new Error(updateJson.error || "Could not save voicemail settings.");
        }
      }
      await runPersonalNumberAction(
        numberId,
        voicemailEnabled ? "enable_voicemail" : "disable_voicemail",
      );
      setSettingsMessage("Saved");
      await loadVoicemail();
    } catch (e) {
      setSettingsMessage(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  async function persistGreeting(patch: { greetingText?: string; greetingUrl?: string }) {
    let boxId = box?.id;
    if (!boxId) boxId = await ensureVoicemailBoxId();
    if (!boxId) throw new Error("Select a number with voicemail to save a greeting.");
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_box", boxId, ...patch }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Could not save greeting.");
    await loadVoicemail();
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
    void audio.play().catch(() => setSettingsMessage("Unable to play greeting."));
  }

  const greetingLabel = box?.greetingUrl
    ? "Personal greeting"
    : box?.greetingText
      ? "Personal greeting"
      : "Default greeting";

  const statusLine = `Voicemail: ${voicemailEnabled ? "On" : "Off"} · Transcription: ${autoTranscription ? "On" : "Off"}`;

  const utilityRail = (
    <>
      <audio ref={greetingPreviewRef} className="hidden" />
      <div className={`mctb-vm-rail-module${numberId ? "" : " mctb-vm-rail-module--disabled"}`}>
        <div className="mctb-vm-rail-head">
          <span>Voicemail greeting</span>
          {numberId ? (
            <span className="text-[12px] font-medium text-[#626872]">Active</span>
          ) : null}
        </div>
        <div className="mctb-vm-rail-body">
          {numberId ? (
            <>
              <p className="font-medium">{greetingLabel}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="mctb-vm-btn" onClick={previewGreeting}>
                  Preview
                </button>
                <button type="button" className="mctb-vm-btn" onClick={() => setGreetingDrawerOpen(true)}>
                  Change
                </button>
              </div>
              <p className="mt-2 text-[12px] text-[#626872]">
                <button type="button" className="underline" onClick={() => setGreetingDrawerOpen(true)}>
                  Record
                </button>
                {" · "}
                <button type="button" className="underline" onClick={() => setGreetingDrawerOpen(true)}>
                  Upload
                </button>
                {" · "}
                <button type="button" className="underline" onClick={() => setGreetingDrawerOpen(true)}>
                  Generate
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] text-[#626872]">
                Select a specific number to manage its greeting.
              </p>
              <div className="mt-2">
                <PersonalNumberSelector
                  numbers={numbers}
                  selectedId={numberId}
                  label=""
                  allowAll={false}
                  selectClassName="h-9 w-full rounded-md border border-[#dee2e6] bg-white px-2 text-[13px]"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mctb-vm-rail-module">
        <div className="mctb-vm-rail-head">Voicemail settings</div>
        <div className="mctb-vm-rail-body px-0">
          <SettingToggle
            label="Voicemail enabled"
            checked={voicemailEnabled}
            onChange={setVoicemailEnabled}
            disabled={!numberId}
          />
          <SettingToggle
            label="Auto-transcription"
            checked={autoTranscription}
            onChange={setAutoTranscription}
            disabled={!numberId}
          />
          <SettingToggle label="Email alerts" checked={emailAlerts} onChange={setEmailAlerts} disabled={!numberId} />
          <SettingToggle label="SMS alerts" checked={smsAlerts} onChange={setSmsAlerts} disabled={!numberId} />
          {emailAlerts ? (
            <div className="px-3 pb-2 space-y-2">
              <label className="block text-[12px] text-[#626872]">
                Primary email
                <input
                  className="mt-1 w-full h-9 rounded-md border border-[#dee2e6] px-2 text-[13px]"
                  value={forwardEmail}
                  onChange={(e) => setForwardEmail(e.target.value)}
                  type="email"
                />
              </label>
              <label className="block text-[12px] text-[#626872]">
                Secondary email (optional)
                <input
                  className="mt-1 w-full h-9 rounded-md border border-[#dee2e6] px-2 text-[13px]"
                  value={secondaryEmail}
                  onChange={(e) => setSecondaryEmail(e.target.value)}
                  type="email"
                />
              </label>
            </div>
          ) : null}
          {smsAlerts ? (
            <div className="px-3 pb-2">
              <label className="block text-[12px] text-[#626872]">
                SMS alert number
                <input
                  className="mt-1 w-full h-9 rounded-md border border-[#dee2e6] px-2 text-[13px]"
                  value={smsNotifyE164}
                  onChange={(e) => setSmsNotifyE164(e.target.value)}
                  placeholder="+15551234567"
                />
              </label>
              <p className="mt-1 text-[11px] text-[#8b939e]">
                Receive an SMS when a new voicemail or transcript is ready.
              </p>
            </div>
          ) : null}
          <div className="mctb-vm-rail-forwarding">
            <p className="mctb-vm-rail-forwarding-title">How calls reach voicemail</p>
            <div className="mctb-vm-rail-forwarding-rows">
              <div className="flex justify-between">
                <span>Forwarding</span>
                <span className="text-[#1b1e23]">{forwardingEnabledLive ? "On" : "Off"}</span>
              </div>
              <div className="flex justify-between">
                <span>Ring time</span>
                <span className="text-[#1b1e23]">{forwardRingSeconds} sec</span>
              </div>
              <div className="flex justify-between">
                <span>Direct voicemail</span>
                <span className="text-[#1b1e23]">Off</span>
              </div>
            </div>
            <Link href={MCTB_ROUTES.setupPhone} className="mt-2 inline-block text-[12px] font-medium">
              Open forwarding settings →
            </Link>
            <button
              type="button"
              className="mt-2 block text-[12px] text-[#626872] underline"
              onClick={() => setTestModalOpen(true)}
            >
              Test voicemail
            </button>
          </div>
          <div className="px-3 pb-3">
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={savingSettings || !numberId}
              onClick={() => void saveSettings()}
            >
              {savingSettings ? "Saving…" : "Save changes"}
            </Button>
            {settingsMessage ? (
              <p className="mt-2 text-center text-[12px] text-[#626872]">{settingsMessage}</p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  const detailPanel = selected ? (
    <MessageDetail
      message={selected}
      calledLabel={managedNumber?.friendlyName || numbers[0]?.friendlyName}
      calledNumber={managedNumber?.number || numbers[0]?.number}
      playSpeed={playSpeed}
      onPlaySpeedChange={setPlaySpeed}
      audioRef={messageAudioRef}
      vmActionMessage={vmActionMessage}
      overflowOpen={overflowOpen}
      onOverflowToggle={() => setOverflowOpen((o) => !o)}
      onMarkRead={() => void markRead(selected.id)}
      onMarkUnread={() => void markUnread(selected.id)}
      onDelete={() => void deleteMessage(selected.id)}
      onRetranscribe={async () => {
        await fetch("/api/phone/voicemail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retranscribe", messageId: selected.id }),
        });
        await loadVoicemail();
      }}
      onNeedsCallback={async () => {
        setVmActionMessage(null);
        const res = await fetch("/api/phone/voicemail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "needs_callback", messageId: selected.id }),
        });
        const json = await res.json();
        setVmActionMessage(res.ok ? "Callback request created." : json.error || "Could not create callback.");
      }}
      onMarkResolved={async () => {
        await fetch("/api/phone/voicemail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_resolved", messageId: selected.id }),
        });
        await loadVoicemail();
      }}
      onBlock={async () => {
        if (!selected.callerNumber) return;
        if (
          !window.confirm(
            "Block this caller? They will be added to your do-not-text / exclusion list.",
          )
        ) {
          return;
        }
        setVmActionMessage(null);
        const res = await fetch("/api/mctb/exclusions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: selected.callerNumber, reason: "Blocked from voicemail" }),
        });
        const json = await res.json();
        setVmActionMessage(res.ok ? "Caller blocked." : json.error || "Could not block caller.");
      }}
      onNotesChange={(value) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === selected.id ? { ...m, internalNotes: value } : m)),
        );
      }}
      onNotesSave={async (value) => {
        setNoteSaveState("saving");
        try {
          const res = await fetch("/api/phone/voicemail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update_message_notes",
              messageId: selected.id,
              internalNotes: value,
            }),
          });
          if (!res.ok) throw new Error("save failed");
          setNoteSaveState("saved");
        } catch {
          setNoteSaveState("error");
        }
      }}
      noteSaveState={noteSaveState}
      transcriptionEnabled={autoTranscription}
    />
  ) : (
    <div className="mctb-vm-detail-empty">
      <Voicemail className="mb-2 h-8 w-8 text-[#8b939e]" aria-hidden />
      <p>Select a voicemail to listen and view its transcript.</p>
    </div>
  );

  return (
    <div className="mctb-vm">
      <div className="mctb-vm-inner">
        <header className="mctb-vm-header">
          <div>
            <h1 className="mctb-vm-title">Voicemail</h1>
            <p className="mctb-vm-desc">
              Manage messages, greetings, transcription, and voicemail delivery.
            </p>
          </div>
          <Link href={MCTB_ROUTES.setupVoicemail} className="mctb-vm-btn mctb-vm-btn--primary h-9">
            Configure voicemail
          </Link>
        </header>

        {numbers.length > 0 ? (
          <div className="mctb-vm-number-bar">
            <PersonalNumberSelector
              numbers={numbers}
              selectedId={numberId}
              label="Managing number"
              allowAll
              selectClassName="h-9 min-w-[12rem] rounded-md border border-[#dee2e6] bg-white px-2 text-[13px] font-medium"
            />
            <span className="mctb-vm-number-bar__status">{statusLine}</span>
          </div>
        ) : null}

        <div className="mctb-vm-metrics">
          <div className="mctb-vm-metric">
            <div className="mctb-vm-metric-label">Total voicemails</div>
            <div className="mctb-vm-metric-value">{loading ? "—" : inboxSummary.totalCount}</div>
            <div className="mctb-vm-metric-sub">All time</div>
          </div>
          <div className="mctb-vm-metric">
            <div className="mctb-vm-metric-label">Unread</div>
            <div className="mctb-vm-metric-value">{loading ? "—" : unreadCount}</div>
            <div className="mctb-vm-metric-sub">Needs review</div>
          </div>
          <div className="mctb-vm-metric">
            <div className="mctb-vm-metric-label">Minutes</div>
            <div className="mctb-vm-metric-value">{loading ? "—" : `${minutesMonth} min`}</div>
            <div className="mctb-vm-metric-sub">This month</div>
          </div>
          <div className="mctb-vm-metric">
            <div className="mctb-vm-metric-label">Transcription</div>
            <div className="mctb-vm-metric-value">{autoTranscription ? "On" : "Off"}</div>
            <div className="mctb-vm-metric-sub">Auto</div>
          </div>
        </div>

        <div className="mctb-vm-tablet-util">
          <button type="button" className="mctb-vm-btn" onClick={() => setUtilityDrawerOpen(true)}>
            Voicemail settings
          </button>
        </div>

        {/* Desktop / tablet workspace */}
        <div className="mctb-vm-workspace">
          <div className="mctb-vm-panel mctb-vm-panel--inbox">
            <div className="mctb-vm-panel-head">Voicemail Inbox</div>
            <div className="mctb-vm-inbox-tools">
              <div className="mctb-vm-search-wrap">
                <Search aria-hidden />
                <label className="sr-only" htmlFor="mctb-vm-search">Search caller or transcript</label>
                <input
                  id="mctb-vm-search"
                  className="mctb-vm-search"
                  placeholder="Search caller or transcript"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="mctb-vm-filter-row">
                <div className="mctb-vm-chips" role="group" aria-label="Inbox filter">
                  {(["All", "Unread", "Read"] as InboxFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`mctb-vm-chip${inboxFilter === f ? " mctb-vm-chip--active" : ""}`}
                      onClick={() => setInboxFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <select
                  className="mctb-vm-sort"
                  aria-label="Sort order"
                  value={inboxSort}
                  onChange={(e) => setInboxSort(e.target.value as VoicemailInboxSort)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>
            {loadError ? (
              <div className="p-6 text-center text-[13px]">
                <p>Unable to load voicemail messages.</p>
                <Button type="button" size="sm" className="mt-3" onClick={() => void loadVoicemail()}>
                  Retry
                </Button>
              </div>
            ) : loading ? (
              <>
                <div className="mctb-vm-skel" />
                <div className="mctb-vm-skel" />
                <div className="mctb-vm-skel" />
              </>
            ) : pagedMessages.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[#626872]">
                <p>No voicemails yet.</p>
                <p className="mt-1 text-[12px]">Voicemails appear when callers leave a message.</p>
                <button type="button" className="mctb-vm-btn mt-3" onClick={() => setTestModalOpen(true)}>
                  Test voicemail
                </button>
              </div>
            ) : (
              <div className="mctb-vm-inbox-scroll">
                <ul className="mctb-vm-list">
                  {pagedMessages.map((m) => (
                    <li key={m.id}>
                      <VoicemailInboxRow
                        message={m}
                        selected={selectedId === m.id}
                        onSelect={() => selectMessage(m.id)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!loading && !loadError ? (
              <DataTablePaginationFooter
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                className="mctb-vm-inbox-pagination"
              />
            ) : null}
          </div>

          <div className="mctb-vm-panel mctb-vm-panel--detail">
            <div className="mctb-vm-panel-head">Selected voicemail</div>
            <div className="mctb-vm-detail">{detailPanel}</div>
          </div>

          <div className="mctb-vm-rail">{utilityRail}</div>
        </div>

        {/* Mobile */}
        <div className="mctb-vm-mobile">
          {!mobileDetailOpen ? (
            <>
              <div className="mctb-vm-panel">
                <div className="mctb-vm-inbox-tools">
                  <div className="mctb-vm-search-wrap">
                    <Search aria-hidden />
                    <input
                      className="mctb-vm-search"
                      placeholder="Search caller or transcript"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="mctb-vm-filter-row">
                    <div className="mctb-vm-chips">
                      {(["All", "Unread", "Read"] as InboxFilter[]).map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`mctb-vm-chip${inboxFilter === f ? " mctb-vm-chip--active" : ""}`}
                          onClick={() => setInboxFilter(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <select
                      className="mctb-vm-sort"
                      value={inboxSort}
                      onChange={(e) => setInboxSort(e.target.value as VoicemailInboxSort)}
                    >
                      <option value="newest">Newest first</option>
                      <option value="oldest">Oldest first</option>
                    </select>
                  </div>
                </div>
                <ul className="mctb-vm-list">
                  {pagedMessages.map((m) => (
                    <li key={m.id}>
                      <VoicemailInboxRow
                        message={m}
                        selected={selectedId === m.id}
                        onSelect={() => selectMessage(m.id)}
                      />
                    </li>
                  ))}
                </ul>
                <DataTablePaginationFooter
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
            </>
          ) : (
            <div className="mctb-vm-mobile-detail">
              <button
                type="button"
                className="mctb-vm-btn mb-3 gap-1"
                onClick={() => setMobileDetailOpen(false)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Voicemail
              </button>
              {detailPanel}
            </div>
          )}
          <div className="mt-3 flex justify-center">
            <Link href={MCTB_ROUTES.setupVoicemail} className="mctb-vm-btn">
              Configure voicemail
            </Link>
          </div>
        </div>
      </div>

      {greetingDrawerOpen ? (
        <>
          <div className="mctb-vm-drawer-backdrop" onClick={() => setGreetingDrawerOpen(false)} />
          <div className="mctb-vm-drawer" role="dialog" aria-label="Change greeting">
            <h2 className="text-lg font-semibold">Change greeting</h2>
            <p className="mt-1 text-[13px] text-[#626872]">Record, upload, generate, or pick from library.</p>
            <div className="mt-4">
              <PersonalGreetingControls
                greetingText={box?.greetingText || "Please leave a message after the tone."}
                greetingUrl={box?.greetingUrl}
                onSaveText={(t) => persistGreeting({ greetingText: t })}
                onSaveUrl={(u) => persistGreeting({ greetingUrl: u })}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void persistGreeting({ greetingText: "Please leave a message after the tone." }).then(
                    () => setSettingsMessage("Default greeting is now active."),
                  )
                }
              >
                Use default greeting
              </Button>
              <Button type="button" size="sm" onClick={() => setGreetingDrawerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {utilityDrawerOpen ? (
        <>
          <div className="mctb-vm-drawer-backdrop" onClick={() => setUtilityDrawerOpen(false)} />
          <div className="mctb-vm-drawer" role="dialog" aria-label="Voicemail settings">
            <h2 className="text-lg font-semibold mb-3">Greeting &amp; settings</h2>
            {utilityRail}
            <Button type="button" className="mt-4 w-full" onClick={() => setUtilityDrawerOpen(false)}>
              Close
            </Button>
          </div>
        </>
      ) : null}

      {testModalOpen ? (
        <>
          <div className="mctb-vm-drawer-backdrop" onClick={() => setTestModalOpen(false)} />
          <div
            className="mctb-vm-drawer max-w-md"
            style={{ width: "min(400px, 100vw)", height: "auto", top: "20%", right: "50%", transform: "translateX(50%)" }}
            role="dialog"
            aria-label="Test voicemail"
          >
            <h2 className="text-lg font-semibold">Test voicemail</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] text-[#374151]">
              <li>Call your business number from another phone.</li>
              <li>Let the configured ring time expire.</li>
              <li>Leave a voicemail message.</li>
              <li>Return here to verify it appears in your inbox.</li>
            </ol>
            {managedNumber?.number ? (
              <p className="mt-3 text-[13px] font-medium">{formatPhone(managedNumber.number)}</p>
            ) : (
              <p className="mt-3 text-[13px] text-[#626872]">Select a managing number to see which line to call.</p>
            )}
            <Button type="button" className="mt-4 w-full" onClick={() => setTestModalOpen(false)}>
              Close
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function formatVmTimeShort(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function SettingToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mctb-vm-setting-row px-3">
      <span className="text-[13px]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`mctb-vm-switch${checked ? " mctb-vm-switch--on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="mctb-vm-switch-thumb" />
      </button>
    </div>
  );
}

function VoicemailInboxRow({
  message: m,
  selected,
  onSelect,
}: {
  message: PersonalVoicemailMessage;
  selected: boolean;
  onSelect: () => void;
}) {
  const primary = voicemailPrimaryLine(m.callerDisplayName, m.callerNumber, formatPhone);
  const secondaryPhone = voicemailSecondaryPhoneLine(m.callerDisplayName, m.callerNumber, formatPhone);
  const showUnknownSub =
    !m.callerDisplayName?.trim() && m.callerNumber && m.callerNumber !== "Unknown";

  return (
    <button
      type="button"
      className={`mctb-vm-row${selected ? " mctb-vm-row--selected" : ""}${!m.isRead ? " mctb-vm-row--unread" : ""}`}
      onClick={onSelect}
    >
      <div className="mctb-vm-row-top">
        <span className="mctb-vm-row-name">
          {!m.isRead ? <span className="mctb-vm-unread-dot" aria-label="Unread" /> : null}
          <span className="truncate">{primary}</span>
        </span>
        <span className="mctb-vm-row-meta">
          <span>{formatVoicemailListTime(m.createdAt)}</span>
          <span className="mctb-vm-row-duration">{formatVoicemailDuration(m.durationSec)}</span>
        </span>
      </div>
      {secondaryPhone ? (
        <div className="mctb-vm-row-phone">{secondaryPhone}</div>
      ) : showUnknownSub ? (
        <div className="mctb-vm-row-phone text-[#8b939e]">Unknown caller</div>
      ) : null}
      {m.transcript ? <p className="mctb-vm-row-preview">{m.transcript}</p> : null}
    </button>
  );
}

function MessageDetail({
  message,
  calledLabel,
  calledNumber,
  playSpeed,
  onPlaySpeedChange,
  audioRef,
  vmActionMessage,
  overflowOpen,
  onOverflowToggle,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onRetranscribe,
  onNeedsCallback,
  onMarkResolved,
  onBlock,
  onNotesChange,
  onNotesSave,
  noteSaveState,
  transcriptionEnabled,
}: {
  message: PersonalVoicemailMessage;
  calledLabel?: string | null;
  calledNumber?: string | null;
  playSpeed: number;
  onPlaySpeedChange: (n: number) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  vmActionMessage: string | null;
  overflowOpen: boolean;
  onOverflowToggle: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onDelete: () => void;
  onRetranscribe: () => void;
  onNeedsCallback: () => void;
  onMarkResolved: () => void;
  onBlock: () => void;
  onNotesChange: (v: string) => void;
  onNotesSave: (v: string) => void;
  noteSaveState: string;
  transcriptionEnabled: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold">{formatPhone(message.callerNumber || "Unknown")}</p>
          <p className="text-[12px] text-[#626872]">{formatPhone(message.callerNumber || "")}</p>
          <p className="mt-2 text-[12px] text-[#626872]">
            Called: {calledLabel || "Main line"}
            {calledNumber ? ` · ${formatPhone(calledNumber)}` : ""}
          </p>
          <p className="text-[12px] text-[#626872]">
            {formatVoicemailDetailWhen(message.createdAt)} · {message.durationSec} sec
          </p>
        </div>
        <span className="text-[12px] font-medium text-[#626872]">{message.isRead ? "Read" : "Unread"}</span>
      </div>

      <div className="mctb-vm-playback">
        <audio
          ref={audioRef}
          controls
          className="flex-1"
          src={`/api/phone/voicemail/${message.id}/recording`}
          aria-label="Voicemail recording"
        />
        <select
          className="h-8 rounded border border-[#dee2e6] text-[12px]"
          aria-label="Playback speed"
          value={playSpeed}
          onChange={(e) => onPlaySpeedChange(Number(e.target.value))}
        >
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
        </select>
        <a
          className="mctb-vm-btn"
          href={`/api/phone/voicemail/${message.id}/recording`}
          download
        >
          Download
        </a>
      </div>

      <div className="mctb-vm-actions">
        <BusinessCallBackButton
          destinationE164={message.callerNumber}
          contextType="voicemail"
          contextRefId={message.id}
          size="sm"
        />
        <button type="button" className="mctb-vm-btn" onClick={() => void onNeedsCallback()}>
          Needs callback
        </button>
        <button type="button" className="mctb-vm-btn" onClick={() => void onMarkResolved()}>
          Mark resolved
        </button>
        <div className="mctb-vm-menu-wrap">
          <button type="button" className="mctb-vm-btn" aria-label="More actions" onClick={onOverflowToggle}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {overflowOpen ? (
            <div className="mctb-vm-menu" role="menu">
              <button type="button" role="menuitem" onClick={message.isRead ? onMarkUnread : onMarkRead}>
                {message.isRead ? "Mark unread" : "Mark read"}
              </button>
              <a
                role="menuitem"
                href={`/api/phone/voicemail/${message.id}/recording`}
                download
                style={{ display: "block", padding: "0.5rem 0.75rem", fontSize: 13, textDecoration: "none", color: "inherit" }}
              >
                Download
              </a>
              <button type="button" role="menuitem" onClick={() => void onRetranscribe()}>
                Retranscribe
              </button>
              <button type="button" role="menuitem" onClick={() => void onBlock()}>
                Block caller
              </button>
              <button type="button" role="menuitem" onClick={onDelete}>
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {vmActionMessage ? <p className="text-[12px] text-[#626872]">{vmActionMessage}</p> : null}

      <h3 className="mctb-vm-section-title">Summary</h3>
      <p className="mctb-vm-section-body">
        {message.summary || "No summary available."}
      </p>

      <h3 className="mctb-vm-section-title">Transcript</h3>
      {message.transcript ? (
        <p className="mctb-vm-section-body">{message.transcript}</p>
      ) : (
        <p className="mctb-vm-section-body text-[#8b939e]">
          {transcriptionEnabled
            ? "Transcript unavailable."
            : "Transcription is turned off for this number."}
        </p>
      )}
      {message.transcriptEnglish ? (
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase text-[#626872]">English</p>
          <p className="mctb-vm-section-body">{message.transcriptEnglish}</p>
        </div>
      ) : null}
      {!message.transcript ? (
        <button type="button" className="mt-2 text-[12px] font-medium underline" onClick={() => void onRetranscribe()}>
          Retranscribe
        </button>
      ) : null}

      <h3 className="mctb-vm-section-title">Internal notes</h3>
      <textarea
        className="mctb-vm-notes"
        value={message.internalNotes ?? ""}
        onChange={(e) => onNotesChange(e.target.value)}
        onBlur={(e) => void onNotesSave(e.target.value)}
        placeholder="Team notes about this voicemail…"
      />
      {noteSaveState === "saving" ? (
        <p className="text-[11px] text-[#626872]">Saving…</p>
      ) : noteSaveState === "saved" ? (
        <p className="text-[11px] text-[#626872]">Saved</p>
      ) : noteSaveState === "error" ? (
        <p className="text-[11px] text-red-600">Failed to save</p>
      ) : null}
    </>
  );
}
