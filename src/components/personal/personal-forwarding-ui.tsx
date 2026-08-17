"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_FORWARDING_ACTIVITY,
  WIREFRAME_FORWARDING_DESTINATIONS,
  WIREFRAME_FORWARDING_USAGE,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { FORWARD_RING_PRESETS } from "@/lib/numbers/personal-call-settings";
import { formatPhone } from "@/lib/utils";
import {
  ArrowRight,
  GripVertical,
  PhoneForwarded,
  Pencil,
  Plus,
  Route,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { PersonalMockProgress } from "./mockup/charts";
import { PersonalGreetingControls } from "./personal-greeting-controls";
import { PersonalNumberSelector } from "./personal-number-selector";
import {
  PersonalMockAsideCard,
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockSelect,
  PersonalMockToggle,
  pm,
} from "./mockup/primitives";

type FallbackAction = "voicemail" | "another_number" | "announcement" | "end";

type UsageData = {
  forwardingMinutesUsed: number;
  forwardingMinutesLimit: number;
  forwardingMinutesRemaining?: number;
  perNumber: Array<{ numberId: string; forwardingMinutes: number }>;
};

type ActivityRow = {
  id: string;
  caller: string;
  calledNumber: string;
  outcome: string;
  date: string;
  time: string;
};

export function PersonalForwardingUI({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const router = useRouter();
  const [editId, setEditId] = useState(initialNumberId || numbers[0]?.id || "");
  const [targets, setTargets] = useState<string[]>([""]);
  const [forwardingOn, setForwardingOn] = useState(false);
  const [forwardMode, setForwardMode] = useState<"single" | "sequential" | "simultaneous">("single");
  const [ringSeconds, setRingSeconds] = useState(25);
  const [useCustomRing, setUseCustomRing] = useState(false);
  const [unansweredAction, setUnansweredAction] = useState<"voicemail" | "end">("voicemail");
  const [busyAction, setBusyAction] = useState<FallbackAction>("voicemail");
  const [failedAction, setFailedAction] = useState<FallbackAction>("voicemail");
  const [incomingHandling, setIncomingHandling] = useState<
    "forward" | "voicemail_only" | "announcement_only"
  >("forward");
  const [callerIdDisplay, setCallerIdDisplay] = useState<"original" | "transovo_number">("original");
  const [callScreening, setCallScreening] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"always" | "custom">("always");
  const [scheduleTimezone, setScheduleTimezone] = useState("America/New_York");
  const [scheduleBlocks, setScheduleBlocks] = useState<
    Array<{
      id: string;
      days: number[];
      startTime: string;
      endTime: string;
      handling: "forward" | "voicemail_only" | "announcement_only";
      targets: string[];
    }>
  >([]);
  const [announcementText, setAnnouncementText] = useState(
    "This number is no longer in service. Please try again later.",
  );
  const [announcementUrl, setAnnouncementUrl] = useState<string | null>(null);
  const [outsideHandling, setOutsideHandling] = useState<"forward" | "voicemail_only" | "announcement_only">(
    "voicemail_only",
  );
  const [outsideTargets, setOutsideTargets] = useState<string[]>([""]);
  const [busyNumber, setBusyNumber] = useState("");
  const [failedNumber, setFailedNumber] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrateKey, setHydrateKey] = useState(0);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  const selected = numbers.find((n) => n.id === editId);

  useEffect(() => {
    if (initialNumberId) setEditId(initialNumberId);
  }, [initialNumberId]);

  useEffect(() => {
    fetch("/api/personal/usage")
      .then((r) => r.json())
      .then((j) => setUsage(j.data ?? null))
      .catch(() => setUsage(null));
  }, []);

  useEffect(() => {
    if (!editId) return;
    const params = new URLSearchParams({ numberId: editId, limit: "5" });
    fetch(`/api/personal/activity?${params}`)
      .then((r) => r.json())
      .then((j) => setActivity(Array.isArray(j.data) ? j.data : []))
      .catch(() => setActivity([]));
  }, [editId]);

  useEffect(() => {
    if (!selected) return;
    setEditId(selected.id);
    const settings =
      selected.settingsJson && typeof selected.settingsJson === "object"
        ? (selected.settingsJson as Record<string, unknown>)
        : {};
    const rawTargets = settings.forwardTargets;
    const list =
      Array.isArray(rawTargets) && rawTargets.length > 0
        ? (rawTargets as string[])
        : selected.voiceForwardTo
          ? [selected.voiceForwardTo]
          : [""];
    setTargets(list);
    setForwardingOn(Boolean(selected.voiceForwardTo || list[0]));
    const ring = settings.forwardRingSeconds;
    const ringVal = typeof ring === "number" ? ring : 25;
    setRingSeconds(ringVal);
    setUseCustomRing(!(FORWARD_RING_PRESETS as readonly number[]).includes(ringVal));
    setUnansweredAction(settings.forwardUnansweredAction === "end" ? "end" : "voicemail");
    setBusyAction((settings.forwardBusyAction as FallbackAction) || "voicemail");
    setFailedAction((settings.forwardFailedAction as FallbackAction) || "voicemail");
    setIncomingHandling(
      settings.incomingCallHandling === "voicemail_only" ||
        settings.incomingCallHandling === "announcement_only"
        ? settings.incomingCallHandling
        : "forward",
    );
    setForwardMode(
      settings.forwardMode === "sequential" || settings.forwardMode === "simultaneous"
        ? settings.forwardMode
        : "single",
    );
    setCallerIdDisplay(
      settings.callerIdDisplay === "transovo_number" ? "transovo_number" : "original",
    );
    setCallScreening(settings.callScreeningEnabled === true);
    setScheduleMode(settings.forwardScheduleMode === "custom" ? "custom" : "always");
    const sched = settings.forwardSchedule;
    if (sched && typeof sched === "object") {
      const s = sched as Record<string, unknown>;
      if (typeof s.timezone === "string") setScheduleTimezone(s.timezone);
      if (Array.isArray(s.blocks)) {
        setScheduleBlocks(
          s.blocks.map((b, i) => {
            const row = b as Record<string, unknown>;
            return {
              id: typeof row.id === "string" ? row.id : `block-${i}`,
              days: Array.isArray(row.days) ? (row.days as number[]) : [1, 2, 3, 4, 5],
              startTime: typeof row.startTime === "string" ? row.startTime : "09:00",
              endTime: typeof row.endTime === "string" ? row.endTime : "17:00",
              handling:
                row.handling === "voicemail_only" || row.handling === "announcement_only"
                  ? row.handling
                  : "forward",
              targets: Array.isArray(row.targets) ? (row.targets as string[]) : [],
            };
          }),
        );
      }
      if (
        s.outsideHandling === "voicemail_only" ||
        s.outsideHandling === "announcement_only" ||
        s.outsideHandling === "forward"
      ) {
        setOutsideHandling(s.outsideHandling);
      }
      if (Array.isArray(s.outsideTargets)) {
        const outs = (s.outsideTargets as string[]).filter((t) => typeof t === "string" && t.trim());
        setOutsideTargets(outs.length > 0 ? outs : [""]);
      } else {
        setOutsideTargets([""]);
      }
    } else {
      setOutsideTargets([""]);
    }
    setAnnouncementText(
      typeof settings.announcementText === "string" && settings.announcementText.trim()
        ? settings.announcementText.trim()
        : "This number is no longer in service. Please try again later.",
    );
    setAnnouncementUrl(
      typeof settings.announcementUrl === "string" && settings.announcementUrl.trim()
        ? settings.announcementUrl.trim()
        : null,
    );
    setBusyNumber(typeof settings.forwardBusyNumber === "string" ? settings.forwardBusyNumber : "");
    setFailedNumber(
      typeof settings.forwardFailedNumber === "string" ? settings.forwardFailedNumber : "",
    );
  }, [selected, hydrateKey]);

  const cleanedTargets = useMemo(() => targets.map((t) => t.trim()).filter(Boolean), [targets]);
  const forwardingMinutes =
    usage?.perNumber.find((p) => p.numberId === editId)?.forwardingMinutes ?? 0;
  const minutesLimit = usage?.forwardingMinutesLimit ?? 500;
  const minutesPct = Math.min(100, Math.round((forwardingMinutes / minutesLimit) * 100));
  const useWireframe = usePersonalWireframe(activity.length + forwardingMinutes, 10);
  const displayMinutes = useWireframe ? WIREFRAME_FORWARDING_USAGE.minutesUsed : forwardingMinutes;
  const displayLimit = useWireframe ? WIREFRAME_FORWARDING_USAGE.minutesLimit : minutesLimit;
  const displayMinutesPct = Math.min(100, Math.round((displayMinutes / displayLimit) * 100));
  const displayActivity =
    useWireframe && activity.length < 3 ? WIREFRAME_FORWARDING_ACTIVITY : activity;
  const displayDestinations = useMemo(() => {
    if (useWireframe && cleanedTargets.length <= 1) {
      return WIREFRAME_FORWARDING_DESTINATIONS.map((d) => ({ ...d, isDemo: true as const }));
    }
    return targets.map((t, i) => ({
      number: t,
      label: "",
      ringSeconds: ringSeconds,
      isDemo: false as const,
      index: i,
    }));
  }, [useWireframe, cleanedTargets.length, targets, ringSeconds]);
  const forwardingHealthy =
    incomingHandling === "forward" &&
    forwardingOn &&
    cleanedTargets.length > 0 &&
    cleanedTargets.every((t) => t.length >= 10);

  function discardChanges() {
    setMessage(null);
    setHydrateKey((k) => k + 1);
  }

  function updateTarget(index: number, value: string) {
    setTargets((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addTarget() {
    if (targets.length >= 5) return;
    setTargets((prev) => [...prev, ""]);
  }

  function removeTarget(index: number) {
    setTargets((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBlockTarget(blockId: string, index: number, value: string) {
    setScheduleBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const base = b.targets.length > 0 ? b.targets : targets.filter(Boolean);
        const next = base.length > 0 ? [...base] : [""];
        return { ...b, targets: next.map((t, i) => (i === index ? value : t)) };
      }),
    );
  }

  function addBlockTarget(blockId: string) {
    setScheduleBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.targets.length >= 5) return b;
        const base = b.targets.length > 0 ? b.targets : targets.filter(Boolean);
        return { ...b, targets: [...base, ""] };
      }),
    );
  }

  function removeBlockTarget(blockId: string, index: number) {
    setScheduleBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, targets: b.targets.filter((_, i) => i !== index) } : b,
      ),
    );
  }

  function updateOutsideTarget(index: number, value: string) {
    setOutsideTargets((prev) => {
      const base = prev.some((t) => t.trim()) ? prev : targets.filter(Boolean);
      const next = base.length > 0 ? [...base] : [""];
      return next.map((t, i) => (i === index ? value : t));
    });
  }

  function addOutsideTarget() {
    if (outsideTargets.length >= 5) return;
    setOutsideTargets((prev) => [...prev, ""]);
  }

  function removeOutsideTarget(index: number) {
    setOutsideTargets((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setMessage(null);
    setSaving(true);
    try {
      const cleanedTargets = targets.map((t) => t.trim()).filter(Boolean);
      const cleanedOutsideTargets = outsideTargets.map((t) => t.trim()).filter(Boolean);
      const normalizedBlocks = scheduleBlocks.map((block) => {
        const blockTargets = block.targets.map((t) => t.trim()).filter(Boolean);
        return {
          ...block,
          targets:
            block.handling === "forward"
              ? blockTargets.length > 0
                ? blockTargets
                : cleanedTargets
              : [],
        };
      });
      const res = await fetch(`/api/numbers/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalCallSettings: {
            incomingCallHandling: incomingHandling,
            announcementText: announcementText.trim(),
            announcementUrl: announcementUrl?.trim() || null,
            forwardingEnabled: forwardingOn && incomingHandling === "forward",
            forwardTargets: cleanedTargets,
            forwardDestination: cleanedTargets[0] || null,
            forwardMode: forwardMode,
            forwardRingSeconds: ringSeconds,
            forwardUnansweredAction: unansweredAction,
            forwardBusyAction: busyAction,
            forwardFailedAction: failedAction,
            forwardBusyNumber: busyAction === "another_number" ? busyNumber.trim() || null : null,
            forwardFailedNumber:
              failedAction === "another_number" ? failedNumber.trim() || null : null,
            voicemailEnabled: unansweredAction === "voicemail" || incomingHandling === "voicemail_only",
            directVoicemail: incomingHandling === "voicemail_only",
            callerIdDisplay,
            callScreeningEnabled: callScreening,
            forwardScheduleMode: scheduleMode,
            forwardSchedule:
              scheduleMode === "custom"
                ? {
                    timezone: scheduleTimezone,
                    blocks: normalizedBlocks,
                    outsideHandling,
                    outsideTargets:
                      outsideHandling === "forward"
                        ? cleanedOutsideTargets.length > 0
                          ? cleanedOutsideTargets
                          : cleanedTargets
                        : [],
                  }
                : null,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Could not save forwarding.");
      }
      setMessage("Forwarding saved.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save forwarding.");
    } finally {
      setSaving(false);
    }
  }

  async function patchAnnouncement(partial: { announcementText?: string; announcementUrl?: string }) {
    const res = await fetch(`/api/numbers/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalCallSettings: partial }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof json.error === "string" ? json.error : "Could not save announcement.");
    }
    router.refresh();
  }

  const showAnnouncementAudio =
    incomingHandling === "announcement_only" ||
    busyAction === "announcement" ||
    failedAction === "announcement";

  if (numbers.length === 0) {
    return (
      <PersonalMockPage>
        <p className={pm.muted}>
          No numbers yet.{" "}
          <Link href="/personal/numbers/premium" className="text-[#2563eb]">
            Find a number
          </Link>
        </p>
      </PersonalMockPage>
    );
  }

  const statusLabel =
    incomingHandling !== "forward"
      ? incomingHandling === "voicemail_only"
        ? "Voicemail"
        : "Announcement"
      : forwardingOn
        ? forwardMode === "sequential"
          ? "Sequential"
          : forwardMode === "simultaneous"
            ? "Simultaneous"
            : "Active"
        : "Inactive";

  const sidebar = (
    <>
      <PersonalMockAsideCard title="Forwarding Status" icon={PhoneForwarded}>
        <div className="flex items-center gap-2">
          <PersonalMockPill tone={forwardingOn && incomingHandling === "forward" ? "green" : "gray"}>
            {statusLabel}
          </PersonalMockPill>
        </div>
        <p className="mt-2">
          {incomingHandling === "forward"
            ? forwardingOn
              ? `Calls ring ${forwardMode === "simultaneous" ? "all destinations" : forwardMode === "sequential" ? "in order" : "one destination"} for ${ringSeconds}s.`
              : "Forwarding is off — callers follow your fallback rules."
            : incomingHandling === "voicemail_only"
              ? "All calls go straight to voicemail."
              : "Callers hear your announcement."}
        </p>
      </PersonalMockAsideCard>

      <div className={pm.card + " space-y-4 p-4"}>
        <div>
          <p className="text-[12px] font-semibold text-[#374151]">Caller ID</p>
          <PersonalMockSelect
            className="mt-2 w-full"
            value={callerIdDisplay}
            onChange={(e) =>
              setCallerIdDisplay(e.target.value as "original" | "transovo_number")
            }
          >
            <option value="original">Show original caller</option>
            <option value="transovo_number">Show my Transovo number</option>
          </PersonalMockSelect>
        </div>
        <PersonalMockToggle
          label="Call screening"
          checked={callScreening}
          onChange={setCallScreening}
        />
      </div>

      <div className={pm.card + " p-4"}>
        <p className="text-[13px] font-semibold text-[#111827]">Usage This Month</p>
        <div className="mt-3">
          <PersonalMockProgress
            value={displayMinutes}
            max={displayLimit}
            label="Forwarding minutes"
            sub={`${useWireframe ? displayLimit - displayMinutes : usage?.forwardingMinutesRemaining ?? Math.max(0, minutesLimit - forwardingMinutes)} remaining`}
          />
        </div>
      </div>

      <PersonalMockAsideCard
        title="Forwarding Health"
        tone={forwardingHealthy ? "default" : "warning"}
      >
        <p>
          {forwardingHealthy
            ? "Destinations look good. Forwarding should work as configured."
            : "Add at least one valid destination and turn forwarding on."}
        </p>
      </PersonalMockAsideCard>

      <div className="flex flex-col gap-2">
        <PersonalMockBtn className="w-full" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save Changes"}
        </PersonalMockBtn>
        <PersonalMockBtn variant="outline" className="w-full" onClick={discardChanges}>
          Discard
        </PersonalMockBtn>
        {message ? <p className="text-center text-[12px] text-[#6b7280]">{message}</p> : null}
      </div>

      <div className={pm.card + " border-[#c7d2fe] bg-[#eef2ff] p-4"}>
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-[#2563eb]" />
          <p className="text-[13px] font-semibold text-[#111827]">Smart Routing</p>
        </div>
        <p className="mt-2 text-[12px] text-[#6b7280]">
          Build advanced call flows with menus, time rules, and AI handoff.
        </p>
        <Link
          href="/smart-routing"
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#2563eb]"
        >
          Explore Smart Routing <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </>
  );

  return (
    <PersonalMockPage right={sidebar}>
      <PersonalMockHeader
        title="Call Forwarding"
        description="Control where your calls go and what happens when they aren't answered."
        actions={
          <>
            <PersonalMockBtn onClick={addTarget}>
              <Plus className="h-4 w-4" />
              Add Forwarding Rule
            </PersonalMockBtn>
            <PersonalMockBtn variant="outline">Test Forwarding</PersonalMockBtn>
          </>
        }
      />

      <div className={pm.card + " flex flex-wrap items-center justify-between gap-3 p-4"}>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            Managing Number
          </p>
          <p className="mt-1 text-[13px] text-[#6b7280]">
            Settings apply to the selected Transovo number.
          </p>
        </div>
        <PersonalNumberSelector numbers={numbers} selectedId={editId} label="" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PersonalMockKpi
          label="Forwarding Status"
          value={statusLabel}
          icon={PhoneForwarded}
          iconClass={
            forwardingOn && incomingHandling === "forward"
              ? "bg-[#ecfdf5] text-[#059669]"
              : "bg-[#f3f4f6] text-[#6b7280]"
          }
        />
        <PersonalMockKpi
          label="Current Destination"
          value={
            useWireframe
              ? formatPhone(WIREFRAME_FORWARDING_DESTINATIONS[0].number)
              : cleanedTargets[0]
                ? formatPhone(cleanedTargets[0])
                : "—"
          }
          sub={
            useWireframe
              ? "Primary Destination"
              : cleanedTargets.length > 1
                ? `+${cleanedTargets.length - 1} more`
                : undefined
          }
        />
        <PersonalMockKpi
          label="Calls Forwarded"
          value={useWireframe ? WIREFRAME_FORWARDING_USAGE.callsForwarded : activity.length}
          sub={useWireframe ? "Total Calls" : "recent on this number"}
        />
        <div className={pm.card + " p-4"}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-medium text-[#6b7280]">Forwarding Minutes</p>
              <p className="mt-1 text-[26px] font-bold leading-none text-[#111827]">
                {displayMinutes}
              </p>
              <p className="mt-1 text-[11px] text-[#9ca3af]">of {displayLimit} min</p>
            </div>
            <RingProgress pct={displayMinutesPct} />
          </div>
        </div>
      </div>

      <PersonalMockSection title="Incoming Call Handling">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <PersonalMockToggle
              label="Forward incoming calls"
              checked={forwardingOn && incomingHandling === "forward"}
              onChange={(on) => {
                if (on) {
                  setIncomingHandling("forward");
                  setForwardingOn(true);
                } else {
                  setForwardingOn(false);
                }
              }}
            />
            <PersonalMockSelect
              className="min-w-[180px]"
              value={incomingHandling}
              onChange={(e) =>
                setIncomingHandling(
                  e.target.value as "forward" | "voicemail_only" | "announcement_only",
                )
              }
            >
              <option value="forward">Forward calls</option>
              <option value="voicemail_only">Voicemail only</option>
              <option value="announcement_only">Announcement only</option>
            </PersonalMockSelect>
          </div>

          {incomingHandling === "forward" && forwardingOn ? (
            <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
              {(
                [
                  ["single", "Single"],
                  ["sequential", "Sequential"],
                  ["simultaneous", "Simultaneous"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForwardMode(mode)}
                  className={`rounded-md px-4 py-1.5 text-[13px] font-semibold transition ${
                    forwardMode === mode
                      ? "bg-white text-[#2563eb] shadow-sm"
                      : "text-[#6b7280] hover:text-[#111827]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </PersonalMockSection>

      {incomingHandling === "announcement_only" ? (
        <PersonalMockSection title="Announcement message">
          <p className={pm.muted}>
            Callers hear this message when they reach your number, then the call ends.
          </p>
          <textarea
            className="mt-3 min-h-[80px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
          />
          <div className="mt-4">
            <p className="text-[12px] font-semibold text-[#374151]">Announcement audio (optional)</p>
            <p className={pm.muted}>
              Upload or record custom audio. When set, callers hear the recording instead of the text above.
            </p>
            <PersonalGreetingControls
              greetingText={announcementText}
              greetingUrl={announcementUrl}
              assetName="Call announcement"
              emptyHint="No announcement audio yet — text above is spoken when callers reach this number."
              scriptPlaceholder="This number is no longer in service. Please try again later."
              createButtonLabel="Create announcement"
              onSaveText={async (text) => {
                setAnnouncementText(text);
                await patchAnnouncement({ announcementText: text });
              }}
              onSaveUrl={async (url) => {
                setAnnouncementUrl(url);
                await patchAnnouncement({ announcementUrl: url });
              }}
            />
          </div>
        </PersonalMockSection>
      ) : null}

      {incomingHandling !== "announcement_only" && showAnnouncementAudio ? (
        <PersonalMockSection title="Announcement audio">
          <p className={pm.muted}>
            Used when forwarding falls back to &quot;Play announcement&quot; (busy, failed, or scheduled announcement windows).
          </p>
          <PersonalGreetingControls
            greetingText={announcementText}
            greetingUrl={announcementUrl}
            assetName="Call announcement"
            emptyHint="No announcement audio — spoken text is used for announcement fallbacks."
            scriptPlaceholder="This number is no longer in service. Please try again later."
            createButtonLabel="Create announcement"
            onSaveText={async (text) => {
              setAnnouncementText(text);
              await patchAnnouncement({ announcementText: text });
            }}
            onSaveUrl={async (url) => {
              setAnnouncementUrl(url);
              await patchAnnouncement({ announcementUrl: url });
            }}
          />
        </PersonalMockSection>
      ) : null}

      {incomingHandling === "forward" ? (
        <>
          <PersonalMockSection
            title="Forward To"
            description="Destinations ring in the order shown for sequential mode."
          >
            <div className="space-y-3">
              {displayDestinations.map((dest, i) => (
                <div
                  key={dest.isDemo ? dest.number : `target-${dest.index}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f3f4f6] bg-[#fafafa] p-3"
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-[#d1d5db]" aria-hidden />
                  <span className="w-6 text-[12px] font-semibold text-[#9ca3af]">{i + 1}</span>
                  {dest.isDemo ? (
                    <div className="min-w-[180px] flex-1">
                      <p className="text-[13px] font-semibold text-[#111827]">
                        {formatPhone(dest.number)}
                      </p>
                      <p className="text-[11px] text-[#6b7280]">{dest.label}</p>
                    </div>
                  ) : (
                    <PersonalMockInput
                      className="min-w-[180px] flex-1"
                      placeholder={dest.index === 0 ? "(571) 477-6175" : "Add another line"}
                      value={dest.number}
                      onChange={(e) => updateTarget(dest.index!, e.target.value)}
                    />
                  )}
                  <PersonalMockSelect className="w-[100px]" value={String(dest.ringSeconds)} disabled={dest.isDemo}>
                    <option value={dest.ringSeconds}>{dest.ringSeconds}s</option>
                  </PersonalMockSelect>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[#6b7280] hover:bg-white"
                    aria-label="Edit destination"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {!dest.isDemo && dest.index! > 0 ? (
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[#dc2626] hover:bg-[#fef2f2]"
                      onClick={() => removeTarget(dest.index!)}
                      aria-label="Remove destination"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              {!useWireframe && targets.length < 5 ? (
                <button
                  type="button"
                  className="text-[13px] font-semibold text-[#2563eb]"
                  onClick={addTarget}
                >
                  + Add Destination
                </button>
              ) : null}
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
                <p className="text-[12px] font-semibold text-[#374151]">Custom ring time</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUseCustomRing(true)}
                    className={`rounded-lg px-3 py-1 text-[12px] ${
                      useCustomRing ? "bg-[#2563eb] text-white" : "border border-[#e5e7eb] bg-white"
                    }`}
                  >
                    Custom
                  </button>
                  {useCustomRing ? (
                    <input
                      type="number"
                      min={10}
                      max={60}
                      className="h-9 w-20 rounded-lg border border-[#e5e7eb] bg-white px-2 text-center text-[13px]"
                      value={ringSeconds}
                      onChange={(e) => setRingSeconds(Number(e.target.value) || 25)}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </PersonalMockSection>

          <PersonalMockSection title="Fallback & Failover">
            <div className="grid gap-4 sm:grid-cols-3">
              <FallbackSelect
                label="If No One Answers"
                value={unansweredAction}
                onChange={(v) => setUnansweredAction(v as "voicemail" | "end")}
                options={[
                  ["voicemail", "Voicemail"],
                  ["end", "End call"],
                ]}
              />
              <FallbackSelect
                label="If Busy"
                value={busyAction}
                onChange={(v) => setBusyAction(v as FallbackAction)}
              />
              <FallbackSelect
                label="If Cannot Be Reached"
                value={failedAction}
                onChange={(v) => setFailedAction(v as FallbackAction)}
              />
            </div>
            {busyAction === "another_number" ? (
              <PersonalMockInput
                className="mt-3 max-w-md"
                placeholder="Alternate number if busy"
                value={busyNumber}
                onChange={(e) => setBusyNumber(e.target.value)}
              />
            ) : null}
            {failedAction === "another_number" ? (
              <PersonalMockInput
                className="mt-3 max-w-md"
                placeholder="Alternate number if forwarding fails"
                value={failedNumber}
                onChange={(e) => setFailedNumber(e.target.value)}
              />
            ) : null}
          </PersonalMockSection>
        </>
      ) : null}

      <ScheduleAndActivitySection
        scheduleMode={scheduleMode}
        setScheduleMode={setScheduleMode}
        scheduleBlocks={scheduleBlocks}
        setScheduleBlocks={setScheduleBlocks}
        scheduleTimezone={scheduleTimezone}
        setScheduleTimezone={setScheduleTimezone}
        outsideHandling={outsideHandling}
        setOutsideHandling={setOutsideHandling}
        targets={targets}
        updateBlockTarget={updateBlockTarget}
        addBlockTarget={addBlockTarget}
        removeBlockTarget={removeBlockTarget}
        outsideTargets={outsideTargets}
        updateOutsideTarget={updateOutsideTarget}
        addOutsideTarget={addOutsideTarget}
        removeOutsideTarget={removeOutsideTarget}
        activity={displayActivity}
        useWireframe={useWireframe}
      />
    </PersonalMockPage>
  );
}

function RingProgress({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative h-11 w-11 shrink-0">
      <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#2563eb"
          strokeWidth="4"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#2563eb]">
        {pct}%
      </span>
    </div>
  );
}

function ScheduleAndActivitySection({
  scheduleMode,
  setScheduleMode,
  scheduleBlocks,
  setScheduleBlocks,
  scheduleTimezone,
  setScheduleTimezone,
  outsideHandling,
  setOutsideHandling,
  targets,
  updateBlockTarget,
  addBlockTarget,
  removeBlockTarget,
  outsideTargets,
  updateOutsideTarget,
  addOutsideTarget,
  removeOutsideTarget,
  activity,
  useWireframe = false,
}: {
  scheduleMode: "always" | "custom";
  setScheduleMode: (v: "always" | "custom") => void;
  scheduleBlocks: Array<{
    id: string;
    days: number[];
    startTime: string;
    endTime: string;
    handling: "forward" | "voicemail_only" | "announcement_only";
    targets: string[];
  }>;
  setScheduleBlocks: Dispatch<
    SetStateAction<
      Array<{
        id: string;
        days: number[];
        startTime: string;
        endTime: string;
        handling: "forward" | "voicemail_only" | "announcement_only";
        targets: string[];
      }>
    >
  >;
  scheduleTimezone: string;
  setScheduleTimezone: (v: string) => void;
  outsideHandling: "forward" | "voicemail_only" | "announcement_only";
  setOutsideHandling: (v: "forward" | "voicemail_only" | "announcement_only") => void;
  targets: string[];
  updateBlockTarget: (blockId: string, index: number, value: string) => void;
  addBlockTarget: (blockId: string) => void;
  removeBlockTarget: (blockId: string, index: number) => void;
  outsideTargets: string[];
  updateOutsideTarget: (index: number, value: string) => void;
  addOutsideTarget: () => void;
  removeOutsideTarget: (index: number) => void;
  activity: ActivityRow[];
  useWireframe?: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PersonalMockSection title="Forwarding Schedule">
        <div className="space-y-3">
          <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
            {(
              [
                ["always", "Always"],
                ["custom", "Custom"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setScheduleMode(mode);
                  if (mode === "custom" && scheduleBlocks.length === 0) {
                    setScheduleBlocks([
                      {
                        id: "weekdays",
                        days: [1, 2, 3, 4, 5],
                        startTime: "08:00",
                        endTime: "17:00",
                        handling: "forward",
                        targets: targets.filter(Boolean),
                      },
                    ]);
                  }
                }}
                className={`rounded-md px-4 py-1.5 text-[13px] font-semibold ${
                  scheduleMode === mode ? "bg-white text-[#6366f1] shadow-sm" : "text-[#6b7280]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {useWireframe ? (
            <div className="space-y-3">
              <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
                <span className="rounded-md px-4 py-1.5 text-[13px] font-semibold text-[#6b7280]">
                  Always
                </span>
                <span className="rounded-md bg-white px-4 py-1.5 text-[13px] font-semibold text-[#2563eb] shadow-sm">
                  Custom Schedule
                </span>
              </div>
              <p className="text-[12px] text-[#6b7280]">America/New_York</p>
              <ul className="space-y-2 text-[13px]">
                {[
                  "Mon–Fri 9:00 AM – 5:00 PM · Forward to destinations",
                  "Evenings · Voicemail",
                  "Weekends · Announcement",
                ].map((row) => (
                  <li
                    key={row}
                    className="rounded-lg border border-[#f3f4f6] bg-[#fafafa] px-3 py-2 text-[#374151]"
                  >
                    {row}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[12px] text-[#1d4ed8]">
                Outside scheduled hours, callers are sent to voicemail.
              </div>
            </div>
          ) : scheduleMode === "custom" ? (
            <div className="space-y-3 rounded-lg border border-[#f3f4f6] p-3">
              <label className="block text-[12px] text-[#6b7280]">
                Timezone
                <PersonalMockInput
                  className="mt-1"
                  value={scheduleTimezone}
                  onChange={(e) => setScheduleTimezone(e.target.value)}
                />
              </label>
              {scheduleBlocks.map((block, idx) => (
                <div key={block.id} className="space-y-2 border-t border-[#f3f4f6] pt-3">
                  <p className="text-[12px] font-semibold">Window {idx + 1}</p>
                  <div className="flex flex-wrap gap-2 text-[12px]">
                    {[
                      ["0", "Sun"],
                      ["1", "Mon"],
                      ["2", "Tue"],
                      ["3", "Wed"],
                      ["4", "Thu"],
                      ["5", "Fri"],
                      ["6", "Sat"],
                    ].map(([d, label]) => (
                      <label key={d} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={block.days.includes(Number(d))}
                          onChange={(e) => {
                            const day = Number(d);
                            setScheduleBlocks((prev) =>
                              prev.map((b) =>
                                b.id === block.id
                                  ? {
                                      ...b,
                                      days: e.target.checked
                                        ? [...b.days, day]
                                        : b.days.filter((x) => x !== day),
                                    }
                                  : b,
                              ),
                            );
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      className="h-9 rounded-lg border border-[#e5e7eb] px-2 text-[13px]"
                      value={block.startTime}
                      onChange={(e) =>
                        setScheduleBlocks((prev) =>
                          prev.map((b) =>
                            b.id === block.id ? { ...b, startTime: e.target.value } : b,
                          ),
                        )
                      }
                    />
                    <span className="text-[13px]">to</span>
                    <input
                      type="time"
                      className="h-9 rounded-lg border border-[#e5e7eb] px-2 text-[13px]"
                      value={block.endTime}
                      onChange={(e) =>
                        setScheduleBlocks((prev) =>
                          prev.map((b) =>
                            b.id === block.id ? { ...b, endTime: e.target.value } : b,
                          ),
                        )
                      }
                    />
                  </div>
                  <PersonalMockSelect
                    className="w-full"
                    value={block.handling}
                    onChange={(e) =>
                      setScheduleBlocks((prev) =>
                        prev.map((b) =>
                          b.id === block.id
                            ? {
                                ...b,
                                handling: e.target.value as typeof block.handling,
                                targets:
                                  e.target.value === "forward"
                                    ? b.targets.length
                                      ? b.targets
                                      : targets.filter(Boolean)
                                    : [],
                              }
                            : b,
                        ),
                      )
                    }
                  >
                    <option value="forward">Forward calls</option>
                    <option value="voicemail_only">Voicemail only</option>
                    <option value="announcement_only">Announcement only</option>
                  </PersonalMockSelect>
                  {block.handling === "forward" ? (
                    <ScheduleTargetList
                      targets={block.targets.length > 0 ? block.targets : targets.filter(Boolean)}
                      onChange={(index, value) => updateBlockTarget(block.id, index, value)}
                      onAdd={() => {
                        if (block.targets.length === 0) {
                          setScheduleBlocks((prev) =>
                            prev.map((b) =>
                              b.id === block.id
                                ? {
                                    ...b,
                                    targets: targets.filter(Boolean).length
                                      ? [...targets.filter(Boolean)]
                                      : [""],
                                  }
                                : b,
                            ),
                          );
                        } else {
                          addBlockTarget(block.id);
                        }
                      }}
                      onRemove={(index) => removeBlockTarget(block.id, index)}
                    />
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="text-[12px] font-semibold text-[#2563eb]"
                onClick={() =>
                  setScheduleBlocks((prev) => [
                    ...prev,
                    {
                      id: `block-${Date.now()}`,
                      days: [6],
                      startTime: "00:00",
                      endTime: "23:59",
                      handling: "voicemail_only",
                      targets: [],
                    },
                  ])
                }
              >
                + Add window
              </button>
              <div>
                <p className="mb-1 text-[12px] font-semibold">Outside schedule</p>
                <PersonalMockSelect
                  className="w-full"
                  value={outsideHandling}
                  onChange={(e) =>
                    setOutsideHandling(
                      e.target.value as "forward" | "voicemail_only" | "announcement_only",
                    )
                  }
                >
                  <option value="forward">Forward calls</option>
                  <option value="voicemail_only">Voicemail only</option>
                  <option value="announcement_only">Announcement only</option>
                </PersonalMockSelect>
                {outsideHandling === "forward" ? (
                  <ScheduleTargetList
                    targets={
                      outsideTargets.some((t) => t.trim())
                        ? outsideTargets
                        : targets.filter(Boolean)
                    }
                    onChange={updateOutsideTarget}
                    onAdd={addOutsideTarget}
                    onRemove={removeOutsideTarget}
                  />
                ) : null}
              </div>
            </div>
          ) : (
            <p className={pm.muted}>Forwarding rules apply 24/7.</p>
          )}
        </div>
      </PersonalMockSection>

      <PersonalMockSection title="Recent Forwarding Activity">
        {activity.length === 0 ? (
          <p className={pm.muted}>
            No recent calls. View full history on{" "}
            <Link href="/personal/activity" className="font-semibold text-[#2563eb]">
              Call Activity
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="pb-2 pr-3">Caller</th>
                  <th className="pb-2 pr-3">Outcome</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {activity.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pr-3 font-medium text-[#111827]">
                      {formatPhone(row.caller)}
                    </td>
                    <td className="py-2.5 pr-3 text-[#6b7280]">{row.outcome}</td>
                    <td className="py-2.5 text-[#6b7280]">
                      {row.date} {row.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PersonalMockSection>
    </div>
  );
}

function ScheduleTargetList({
  targets,
  onChange,
  onAdd,
  onRemove,
}: {
  targets: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const list = targets.length > 0 ? targets : [""];
  return (
    <div className="mt-2 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
        Forward to
      </p>
      {list.map((target, i) => (
        <div key={i} className="flex items-center gap-2">
          <PersonalMockInput
            placeholder="Phone number"
            value={target}
            onChange={(e) => onChange(i, e.target.value)}
          />
          {i > 0 ? (
            <button
              type="button"
              className="text-[12px] text-[#6b7280]"
              onClick={() => onRemove(i)}
            >
              Remove
            </button>
          ) : null}
        </div>
      ))}
      {list.length < 5 ? (
        <button type="button" className="text-[12px] font-medium text-[#6366f1]" onClick={onAdd}>
          + Add line
        </button>
      ) : null}
    </div>
  );
}

function FallbackSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options?: Array<[string, string]>;
}) {
  const defaultOptions: Array<[string, string]> = [
    ["voicemail", "Voicemail"],
    ["another_number", "Another number"],
    ["announcement", "Play announcement"],
    ["end", "End call"],
  ];
  const list = options ?? defaultOptions;
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#374151]">{label}</p>
      <PersonalMockSelect className="mt-2 w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {list.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </PersonalMockSelect>
    </div>
  );
}
