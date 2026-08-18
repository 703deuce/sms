"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import {
  WIREFRAME_FORWARDING_ACTIVITY,
  WIREFRAME_FORWARDING_DESTINATIONS,
  WIREFRAME_FORWARDING_FALLBACK,
  WIREFRAME_FORWARDING_SCHEDULE,
  WIREFRAME_FORWARDING_USAGE,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { FORWARD_RING_PRESETS } from "@/lib/numbers/personal-call-settings";
import { cn, formatPhone } from "@/lib/utils";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gift,
  GripVertical,
  Info,
  Phone,
  PhoneForwarded,
  Pencil,
  Plus,
  Route,
  Save,
  Shield,
  Trash2,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { PersonalMockProgress } from "./mockup/charts";
import { isSmartRoutingInNav } from "@/lib/workspace/platform-launch";
import { PersonalGreetingControls } from "./personal-greeting-controls";
import { PersonalNumberSelector } from "./personal-number-selector";
import {
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockInput,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockSelect,
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

type ActivityDisplayRow = {
  id: string;
  caller: string;
  forwardedTo: string;
  outcome: string;
  outcomeTone: "green" | "purple" | "orange" | "gray";
  time: string;
};

type OutcomeTone = ActivityDisplayRow["outcomeTone"];

function fallbackActionLabel(action: FallbackAction | "voicemail" | "end"): string {
  if (action === "voicemail") return "Send to Transovo Voicemail";
  if (action === "end") return "End call";
  if (action === "another_number") return "Try Another Number";
  if (action === "announcement") return "Play announcement";
  return action;
}

function unansweredActionLabel(
  action: "transovo_voicemail" | "destination_voicemail" | "hang_up",
): string {
  if (action === "transovo_voicemail") return "Use Transovo voicemail";
  if (action === "destination_voicemail") return "Use forwarded phone voicemail";
  return "Hang up";
}

function outcomeToneFromLabel(outcome: string): OutcomeTone {
  const o = outcome.toLowerCase();
  if (o.includes("answer")) return "green";
  if (o.includes("voicemail") || o.includes("no answer")) return "purple";
  if (o.includes("busy") || o.includes("backup") || o.includes("fail")) return "orange";
  return "gray";
}

function outcomePillTone(tone: OutcomeTone): "green" | "purple" | "orange" | "gray" {
  if (tone === "green") return "green";
  if (tone === "purple") return "purple";
  if (tone === "orange") return "orange";
  return "gray";
}

export function PersonalForwardingUI({
  numbers,
  initialNumberId,
}: {
  numbers: PersonalNumberRow[];
  initialNumberId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editId, setEditId] = useState(
    () => searchParams.get("numberId") || initialNumberId || numbers[0]?.id || "",
  );
  const [targets, setTargets] = useState<string[]>([""]);
  const [forwardingOn, setForwardingOn] = useState(false);
  const [forwardMode, setForwardMode] = useState<"single" | "sequential" | "simultaneous">("single");
  const [ringSeconds, setRingSeconds] = useState(20);
  const [useCustomRing, setUseCustomRing] = useState(false);
  const [unansweredAction, setUnansweredAction] = useState<
    "transovo_voicemail" | "destination_voicemail" | "hang_up"
  >("transovo_voicemail");
  const [busyAction, setBusyAction] = useState<FallbackAction>("voicemail");
  const [failedAction, setFailedAction] = useState<FallbackAction>("voicemail");
  const [incomingHandling, setIncomingHandling] = useState<
    "forward" | "voicemail_only" | "announcement_only"
  >("forward");
  const [callerIdDisplay, setCallerIdDisplay] = useState<"original" | "transovo_number">("original");
  const [callScreening, setCallScreening] = useState(false);
  const [screeningPrompt, setScreeningPrompt] = useState("press_1");
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
    const fromUrl = searchParams.get("numberId");
    const nextId = fromUrl || initialNumberId || numbers[0]?.id || "";
    if (nextId && nextId !== editId) setEditId(nextId);
  }, [searchParams, initialNumberId, numbers, editId]);

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
    setUnansweredAction(
      settings.forwardUnansweredAction === "hang_up"
        ? "hang_up"
        : settings.forwardUnansweredAction === "destination_voicemail"
          ? "destination_voicemail"
          : "transovo_voicemail",
    );
    setBusyAction((settings.forwardBusyAction as FallbackAction) || "voicemail");
    setFailedAction((settings.forwardFailedAction as FallbackAction) || "voicemail");
    setIncomingHandling(
      settings.incomingCallHandling === "voicemail_only" ||
        settings.incomingCallHandling === "announcement_only"
        ? settings.incomingCallHandling
        : "forward",
    );
    setForwardMode(
      settings.forwardMode === "sequential"
        ? "sequential"
        : settings.forwardMode === "simultaneous"
          ? "simultaneous"
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
  }, [editId, numbers, hydrateKey]);

  const cleanedTargets = useMemo(() => targets.map((t) => t.trim()).filter(Boolean), [targets]);
  const forwardingMinutes =
    usage?.perNumber.find((p) => p.numberId === editId)?.forwardingMinutes ?? 0;
  const minutesLimit = usage?.forwardingMinutesLimit ?? 500;
  const minutesRemaining =
    usage?.forwardingMinutesRemaining ?? Math.max(0, minutesLimit - forwardingMinutes);
  const useWireframe = usePersonalWireframe(activity.length + forwardingMinutes, 10);
  const displayMinutes = useWireframe ? WIREFRAME_FORWARDING_USAGE.minutesUsed : forwardingMinutes;
  const displayLimit = useWireframe ? WIREFRAME_FORWARDING_USAGE.minutesLimit : minutesLimit;
  const displayCalls = useWireframe ? WIREFRAME_FORWARDING_USAGE.callsForwarded : activity.length;
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

  const displayActivityRows = useMemo((): ActivityDisplayRow[] => {
    if (useWireframe && activity.length < 3) {
      return WIREFRAME_FORWARDING_ACTIVITY.map((r) => ({
        id: r.id,
        caller: r.caller,
        forwardedTo: formatPhone(r.forwardedTo) || r.forwardedTo,
        outcome: r.outcome,
        outcomeTone: r.outcomeTone,
        time: r.time,
      }));
    }
    return activity.map((r) => ({
      id: r.id,
      caller: r.caller,
      forwardedTo: cleanedTargets[0]
        ? formatPhone(cleanedTargets[0])
        : formatPhone(r.calledNumber),
      outcome: r.outcome,
      outcomeTone: outcomeToneFromLabel(r.outcome),
      time: `${r.date} ${r.time}`,
    }));
  }, [useWireframe, activity, cleanedTargets]);

  const forwardingHealthy =
    incomingHandling === "forward" &&
    forwardingOn &&
    cleanedTargets.length > 0 &&
    cleanedTargets.every((t) => t.length >= 10);

  const isForwardingActive = incomingHandling === "forward" && forwardingOn;
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
  const statusSub = useWireframe
    ? WIREFRAME_FORWARDING_USAGE.statusSub
    : forwardMode === "sequential"
      ? "Sequential Mode"
      : forwardMode === "simultaneous"
        ? "Simultaneous Mode"
        : "Single Destination";
  const primaryDestination = useWireframe
    ? formatPhone(WIREFRAME_FORWARDING_DESTINATIONS[0].number)
    : cleanedTargets[0]
      ? formatPhone(cleanedTargets[0])
      : "—";
  const greetingLabel = selected?.friendlyName
    ? `${selected.friendlyName} Greeting`
    : "Main Line Greeting";

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
      const cleanedTargetsSave = targets.map((t) => t.trim()).filter(Boolean);
      const cleanedOutsideTargets = outsideTargets.map((t) => t.trim()).filter(Boolean);
      const normalizedBlocks = scheduleBlocks.map((block) => {
        const blockTargets = block.targets.map((t) => t.trim()).filter(Boolean);
        return {
          ...block,
          targets:
            block.handling === "forward"
              ? blockTargets.length > 0
                ? blockTargets
                : cleanedTargetsSave
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
            forwardTargets: cleanedTargetsSave,
            forwardDestination: cleanedTargetsSave[0] || null,
            forwardMode: forwardMode,
            forwardRingSeconds: ringSeconds,
            forwardUnansweredAction: unansweredAction,
            forwardBusyAction: busyAction,
            forwardFailedAction: failedAction,
            forwardBusyNumber: busyAction === "another_number" ? busyNumber.trim() || null : null,
            forwardFailedNumber:
              failedAction === "another_number" ? failedNumber.trim() || null : null,
            voicemailEnabled:
              unansweredAction === "transovo_voicemail" || incomingHandling === "voicemail_only",
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
                          : cleanedTargetsSave
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

  const effectiveForwardMode = useWireframe ? "sequential" : forwardMode;
  const effectiveScheduleMode = useWireframe ? "custom" : scheduleMode;

  if (numbers.length === 0) {
    return (
      <PersonalMockPage>
        <p className={pm.muted}>
          No numbers yet.{" "}
          <Link href="/personal/numbers/premium" className="text-[#6366f1]">
            Find a number
          </Link>
        </p>
      </PersonalMockPage>
    );
  }

  const displayCallScreening = callScreening;
  const sidebarStatusLabel = isForwardingActive ? "Active" : statusLabel;

  const sidebar = (
  <>
    <div className={pm.card + " p-4"}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#111827]">Forwarding Status</p>
        <PersonalMockPill tone={isForwardingActive ? "green" : "gray"}>{sidebarStatusLabel}</PersonalMockPill>
      </div>
      <dl className="mt-3 space-y-2 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Mode</dt>
          <dd className="font-medium text-[#111827]">{statusSub}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Primary Destination</dt>
          <dd className="font-medium text-[#111827]">{primaryDestination}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[#6b7280]">Destinations</dt>
          <dd className="font-medium text-[#111827]">{displayDestinations.length} Numbers</dd>
        </div>
      </dl>
      <button type="button" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6366f1]">
        View Routing Order <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>

    <div className={pm.card + " p-4"}>
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-[#6366f1]" />
        <p className="text-[13px] font-semibold text-[#111827]">Caller ID</p>
      </div>
      <label className="mt-3 block text-[11px] font-medium text-[#9ca3af]">
        Choice
        <PersonalMockSelect
          className="mt-1 w-full text-[12px]"
          value={callerIdDisplay}
          onChange={(e) => setCallerIdDisplay(e.target.value as "original" | "transovo_number")}
        >
          <option value="original">Original Caller</option>
          <option value="transovo_number">Show my Transovo number</option>
        </PersonalMockSelect>
      </label>
    </div>

    <div className={pm.card + " p-4"}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#6366f1]" />
          <p className="text-[13px] font-semibold text-[#111827]">Call Screening</p>
        </div>
        <MockToggle
          checked={displayCallScreening}
          onChange={(on) => {
            if (!useWireframe) setCallScreening(on);
          }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#6b7280]">
        Require you to press 1 before a forwarded call connects. This prevents your mobile
        voicemail or automated systems from accidentally answering the call.
        {unansweredAction === "transovo_voicemail" && !callScreening ? (
          <span className="mt-1 block text-[#6366f1]">
            For stronger voicemail protection, turn Call Screening on.
          </span>
        ) : null}
      </p>
      {callScreening ? (
        <label className="mt-3 block text-[11px] font-medium text-[#9ca3af]">
          Prompt
          <PersonalMockSelect
            className="mt-1 w-full text-[12px]"
            value={screeningPrompt}
            onChange={(e) => setScreeningPrompt(e.target.value)}
          >
            <option value="press_1">Press 1 to accept</option>
            <option value="name">Announce caller name</option>
          </PersonalMockSelect>
        </label>
      ) : null}
    </div>

    <div className={pm.card + " p-4"}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-[#6366f1]" />
        <p className="text-[13px] font-semibold text-[#111827]">Usage This Month</p>
      </div>
      <p className="mt-3 text-[22px] font-bold text-[#111827]">
        {displayMinutes} / {displayLimit}{" "}
        <span className="text-[14px] font-medium text-[#6b7280]">minutes</span>
      </p>
      <PersonalMockProgress
        value={displayMinutes}
        max={displayLimit}
        label=""
        sub=""
        className="mt-2"
      />
      <div className="mt-3 flex justify-between text-[12px]">
        <span className="text-[#6b7280]">Estimated Overage</span>
        <span className="font-semibold text-[#111827]">$0.00</span>
      </div>
    </div>

    <div className={pm.card + " p-4"}>
      <div className="flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669]" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-[#059669]">
            {useWireframe || forwardingHealthy
              ? "Primary Destination Reachable"
              : "Forwarding Health"}
          </p>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            {useWireframe || forwardingHealthy
              ? "Your primary destination responded successfully on recent test calls."
              : "Add at least one valid destination and turn forwarding on."}
          </p>
          <p className="mt-2 text-[11px] text-[#9ca3af]">
            Last successful forward: {displayActivityRows[0]?.time ?? "—"}
          </p>
          <p className="text-[11px] text-[#9ca3af]">Recent failures: 0</p>
          <Link
            href="/personal/activity"
            className="mt-2 text-[12px] font-semibold text-[#6366f1]"
          >
            View Health Details
          </Link>
        </div>
      </div>
    </div>

    <PersonalMockBtn className="w-full" disabled={saving} onClick={save}>
      <Save className="h-4 w-4" />
      {saving ? "Saving…" : "Save Changes"}
    </PersonalMockBtn>
    <button
      type="button"
      className="w-full py-2 text-center text-[13px] font-medium text-[#6b7280] hover:text-[#111827]"
      onClick={discardChanges}
    >
      Discard
    </button>
    {message ? <p className="text-center text-[12px] text-[#6b7280]">{message}</p> : null}

    {isSmartRoutingInNav() ? (
      <div className={pm.card + " border-[#c7d2fe] bg-[#eef2ff] p-4"}>
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-[#6366f1]" />
          <p className="text-[13px] font-semibold text-[#111827]">Need a Call Menu?</p>
        </div>
        <p className="mt-2 text-[12px] text-[#6b7280]">
          Route callers with menus and time-based rules before they reach forwarding.
        </p>
        <Link
          href="/smart-routing"
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6366f1]"
        >
          Set Up Smart Routing <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    ) : null}
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
            <Link href="/personal/activity">
              <PersonalMockBtn variant="outline">View Forwarding Activity</PersonalMockBtn>
            </Link>
          </>
        }
      />

      <div className={pm.card + " p-4"}>
        <p className="text-[12px] font-semibold text-[#6b7280]">Managing Number</p>
        <div className="mt-2">
          <PersonalNumberSelector
            numbers={numbers}
            label=""
            selectClassName="h-10 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px] font-semibold text-[#111827]"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PersonalMockKpi
          label="Forwarding Status"
          value={useWireframe ? "Active" : statusLabel}
          sub={statusSub}
          icon={PhoneForwarded}
          iconClass="bg-[#ecfdf5] text-[#059669]"
          valueClassName={isForwardingActive ? "text-[#059669]" : undefined}
        />
        <PersonalMockKpi
          label="Current Destination"
          value={primaryDestination}
          sub="Primary Destination"
          icon={ArrowUpRight}
          iconClass="bg-[#f3e8ff] text-[#9333ea]"
        />
        <PersonalMockKpi
          label="Calls Forwarded This Month"
          value={displayCalls}
          sub="Total Calls"
          icon={BarChart3}
          iconClass="bg-[#eef2ff] text-[#6366f1]"
        />
        <div className={pm.card + " p-4"}>
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff7ed] text-[#ea580c]">
              <Clock className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-[#6b7280]">Forwarding Minutes</p>
              <p className="mt-0.5 text-[28px] font-bold leading-none text-[#111827]">
                {displayMinutes} / {displayLimit}
              </p>
              <PersonalMockProgress
                value={displayMinutes}
                max={displayLimit}
                label=""
                sub=""
                className="mt-2"
              />
            </div>
          </div>
        </div>
      </div>

      <div className={pm.card + " overflow-hidden"}>
        <div className="flex items-start justify-between gap-4 border-b border-[#f3f4f6] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827]">Incoming Call Handling</h2>
            <p className="mt-0.5 text-[12px] font-medium text-[#374151]">Forward Incoming Calls</p>
            <p className="text-[11px] text-[#6b7280]">Enable call forwarding for this number</p>
          </div>
          <MockToggle
            checked={isForwardingActive}
            onChange={(on) => {
              if (on) {
                setIncomingHandling("forward");
                setForwardingOn(true);
              } else {
                setForwardingOn(false);
              }
            }}
          />
        </div>

        <div className="p-5 space-y-5">
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
                  className={cn(
                    "rounded-md px-4 py-1.5 text-[13px] font-semibold transition",
                    effectiveForwardMode === mode
                      ? "bg-[#6366f1] text-white shadow-sm"
                      : "text-[#6b7280] hover:text-[#111827]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <PersonalMockSelect
              className="max-w-xs"
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
          )}

          {incomingHandling === "forward" ? (
            <div>
              <p className="mb-1 text-[13px] font-semibold text-[#111827]">Forward To</p>
              <p className="mb-3 text-[11px] text-[#9ca3af]">Drag to reorder destinations.</p>
              <div className="space-y-2">
                {displayDestinations.map((dest, i) => (
                  <div
                    key={dest.isDemo ? dest.number : `target-${dest.index}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white p-3"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 text-[#d1d5db]" aria-hidden />
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#eef2ff] text-[12px] font-bold text-[#6366f1]"
                    >
                      {i + 1}
                    </span>
                    {dest.isDemo ? (
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-[#111827]">
                          {formatPhone(dest.number)}
                        </span>
                        <PersonalMockPill tone="gray">{dest.label}</PersonalMockPill>
                      </div>
                    ) : (
                      <PersonalMockInput
                        className="min-w-[160px] flex-1"
                        placeholder={dest.index === 0 ? "(571) 477-6175" : "Add another line"}
                        value={dest.number}
                        onChange={(e) => updateTarget(dest.index!, e.target.value)}
                      />
                    )}
                    <span className="text-[11px] text-[#9ca3af]">Ring for</span>
                    <PersonalMockSelect
                      className="w-[88px] text-[12px]"
                      value={String(dest.isDemo ? dest.ringSeconds : ringSeconds)}
                      disabled={dest.isDemo}
                      onChange={(e) => setRingSeconds(Number(e.target.value) || 20)}
                    >
                      {FORWARD_RING_PRESETS.map((s) => (
                        <option key={s} value={s}>{s} sec</option>
                      ))}
                    </PersonalMockSelect>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[#6366f1] hover:bg-[#eef2ff]"
                      aria-label="Edit destination"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-[#dc2626] hover:bg-[#fef2f2]"
                      onClick={() => {
                        if (!dest.isDemo) removeTarget(dest.index!);
                      }}
                      aria-label="Remove destination"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {!useWireframe && targets.length < 5 ? (
                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#c7d2fe] py-2.5 text-[13px] font-semibold text-[#6366f1] hover:bg-[#eef2ff]"
                  onClick={addTarget}
                >
                  <Plus className="h-4 w-4" />
                  Add Destination
                </button>
              ) : useWireframe ? (
                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#c7d2fe] py-2.5 text-[13px] font-semibold text-[#6366f1]"
                  onClick={addTarget}
                >
                  <Plus className="h-4 w-4" />
                  Add Destination
                </button>
              ) : null}
              {incomingHandling === "forward" && forwardingOn && !useWireframe ? (
                <p className="mt-3 text-[11px] leading-relaxed text-[#6b7280]">
                  <strong className="font-medium text-[#374151]">Ring for</strong> sets how long
                  your forwarding destination rings before fallback. When using Transovo voicemail,
                  pick a shorter time if your mobile voicemail usually picks up quickly.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {incomingHandling === "announcement_only" ? (
        <PersonalMockSection title="Announcement message">
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
          />
          <PersonalGreetingControls
            greetingText={announcementText}
            greetingUrl={announcementUrl}
            assetName="Call announcement"
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
        <PersonalMockSection title="Fallback & Failover">
          <div className="divide-y divide-[#f3f4f6]">
            {useWireframe
              ? WIREFRAME_FORWARDING_FALLBACK.map((row) => (
                  <FallbackRow
                    key={row.condition}
                    condition={row.condition}
                    action={row.action}
                    pills={row.pills}
                  />
                ))
              : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-[13px] font-medium text-[#111827]">If No One Answers</p>
                      <p className="mt-0.5 text-[11px] text-[#6b7280]">
                        {unansweredAction === "transovo_voicemail"
                          ? "We’ll send callers to your Transovo voicemail after your selected ring time."
                          : unansweredAction === "destination_voicemail"
                            ? "Allow your forwarded phone’s carrier voicemail to answer."
                            : "End the call without voicemail."}
                      </p>
                    </div>
                    <PersonalMockSelect
                      className="min-w-[200px] text-[12px]"
                      value={unansweredAction}
                      onChange={(e) =>
                        setUnansweredAction(
                          e.target.value as
                            | "transovo_voicemail"
                            | "destination_voicemail"
                            | "hang_up",
                        )
                      }
                    >
                      <option value="transovo_voicemail">Use Transovo voicemail</option>
                      <option value="destination_voicemail">Use forwarded phone voicemail</option>
                      <option value="hang_up">Hang up</option>
                    </PersonalMockSelect>
                  </div>
                  <FallbackRow
                    condition="If Destination Is Busy"
                    action={fallbackActionLabel(busyAction)}
                  />
                  <FallbackRow
                    condition="If Destination Cannot Be Reached"
                    action={fallbackActionLabel(failedAction)}
                    pills={
                      failedAction === "announcement"
                        ? [announcementText.trim() || "Play announcement"]
                        : undefined
                    }
                  />
                </>
              )}
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
      ) : null}

      {incomingHandling !== "announcement_only" && showAnnouncementAudio ? (
        <PersonalMockSection title="Announcement audio">
          <PersonalGreetingControls
            greetingText={announcementText}
            greetingUrl={announcementUrl}
            assetName="Call announcement"
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

      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalMockSection title="Forwarding Schedule">
          <SchedulePanel
            scheduleMode={effectiveScheduleMode}
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
            useWireframe={useWireframe}
          />
        </PersonalMockSection>

        <PersonalMockSection
          title="Recent Forwarding Activity"
          action={
            <Link href="/personal/activity" className="text-[12px] font-semibold text-[#6366f1]">
              View All
            </Link>
          }
        >
          {displayActivityRows.length === 0 ? (
            <p className={pm.muted}>No recent forwarding activity.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="pb-2 pr-3">Caller</th>
                    <th className="pb-2 pr-3">Forwarded To</th>
                    <th className="pb-2 pr-3">Outcome</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {displayActivityRows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-2 font-medium text-[#111827]">
                          <Phone className="h-3.5 w-3.5 text-[#9ca3af]" />
                          {formatPhone(row.caller)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-[#6b7280]">{row.forwardedTo}</td>
                      <td className="py-2.5 pr-3">
                        <PersonalMockPill tone={outcomePillTone(row.outcomeTone)}>
                          {row.outcome}
                        </PersonalMockPill>
                      </td>
                      <td className="py-2.5 text-[#6b7280]">{row.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PersonalMockSection>
      </div>
    </PersonalMockPage>
  );
}

function MockToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition",
        checked ? "bg-[#6366f1]" : "bg-[#d1d5db]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function FallbackRow({
  condition,
  action,
  pills,
}: {
  condition: string;
  action: string;
  pills?: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3 text-[13px]">
      <span className="font-medium text-[#111827]">{condition}</span>
      <ArrowRight className="h-4 w-4 text-[#9ca3af]" />
      <span className="text-[#374151]">{action}</span>
      {pills?.map((pill) => (
        <PersonalMockPill key={pill} tone="gray">{pill}</PersonalMockPill>
      ))}
      <ChevronRight className="ml-auto h-4 w-4 text-[#9ca3af]" />
    </div>
  );
}

function SchedulePanel({
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
  useWireframe,
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
  useWireframe: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1">
        {(["always", "custom"] as const).map((mode) => {
          const isActive = scheduleMode === mode || (useWireframe && mode === "custom");
          return (
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
            className={cn(
              "rounded-md px-4 py-1.5 text-[13px] font-semibold",
              isActive
                ? mode === "custom"
                  ? "bg-[#6366f1] text-white shadow-sm"
                  : "bg-white text-[#6b7280] shadow-sm"
                : "text-[#6b7280]",
            )}
          >
            {mode === "always" ? "Always" : "Custom Schedule"}
          </button>
          );
        })}
      </div>

      {useWireframe ? (
        <div className="space-y-3">
          <label className="block text-[12px] font-medium text-[#6b7280]">
            Timezone
            <PersonalMockSelect
              className="mt-1 w-full text-[12px]"
              value={scheduleTimezone}
              onChange={(e) => setScheduleTimezone(e.target.value)}
            >
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
            </PersonalMockSelect>
          </label>
          <ul className="space-y-2 text-[13px]">
            {WIREFRAME_FORWARDING_SCHEDULE.map((row) => {
              const RowIcon =
                row.icon === "calendar" ? CalendarDays : row.icon === "clock" ? Clock : Gift;
              return (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-[#f3f4f6] bg-[#fafafa] px-3 py-2"
              >
                <span className="flex items-center gap-2 text-[#374151]">
                  <RowIcon className="h-4 w-4 text-[#9ca3af]" />
                  {row.label}
                </span>
                <span className="flex items-center gap-1 text-[#6b7280]">
                  {row.dest} <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </li>
              );
            })}
          </ul>
          <div className="flex gap-2 rounded-lg border border-[#bfdbfe] bg-[#eff6ff] p-3 text-[12px] text-[#1d4ed8]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Outside scheduled hours, callers are sent to voicemail.</p>
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
              <PersonalMockSelect
                className="w-full"
                value={block.handling}
                onChange={(e) =>
                  setScheduleBlocks((prev) =>
                    prev.map((b) =>
                      b.id === block.id
                        ? { ...b, handling: e.target.value as typeof block.handling }
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
                  onAdd={() => addBlockTarget(block.id)}
                  onRemove={(index) => removeBlockTarget(block.id, index)}
                />
              ) : null}
            </div>
          ))}
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
          </div>
        </div>
      ) : (
        <p className={pm.muted}>Forwarding rules apply 24/7.</p>
      )}
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
      {list.map((target, i) => (
        <div key={i} className="flex items-center gap-2">
          <PersonalMockInput
            placeholder="Phone number"
            value={target}
            onChange={(e) => onChange(i, e.target.value)}
          />
          {i > 0 ? (
            <button type="button" className="text-[12px] text-[#6b7280]" onClick={() => onRemove(i)}>
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
