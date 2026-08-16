"use client";

import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { FORWARD_RING_PRESETS } from "@/lib/numbers/personal-call-settings";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PersonalNumberSelector } from "./personal-number-selector";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  PersonalStatusBadge,
  pMuted,
} from "./personal-ui";
import { PersonalGreetingControls } from "./personal-greeting-controls";

type FallbackAction = "voicemail" | "another_number" | "announcement" | "end";

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

  const selected = numbers.find((n) => n.id === editId);

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
  }, [selected]);

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
      <PersonalPageWrap>
        <p className={pMuted}>
          No numbers yet.{" "}
          <Link href="/personal/numbers/premium" className="text-[#6366f1]">Find a number</Link>
        </p>
      </PersonalPageWrap>
    );
  }

  const mappedNumbers = numbers;

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Call Forwarding"
        description="Ring your phone first. If you don't answer, Transovo can take the voicemail — not your carrier."
      />

      <PersonalNumberSelector numbers={mappedNumbers} selectedId={editId} />

      <PersonalSection title="Incoming call handling">
        <div className="flex flex-wrap gap-2 text-[13px]">
          {(
            [
              ["forward", "Forward calls"],
              ["voicemail_only", "Voicemail only"],
              ["announcement_only", "Announcement only"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setIncomingHandling(value)}
              className={`rounded-lg border px-3 py-2 ${
                incomingHandling === value
                  ? "border-[#6366f1] bg-[#eef2ff] text-[#4338ca]"
                  : "border-[#e5e7eb] bg-white text-[#374151]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </PersonalSection>

      {incomingHandling === "announcement_only" ? (
        <PersonalSection title="Announcement message">
          <p className={pMuted}>
            Callers hear this message when they reach your number, then the call ends.
          </p>
          <textarea
            className="mt-2 min-h-[80px] w-full max-w-lg rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
          />
          <div className="mt-4">
            <p className="text-[12px] font-semibold text-[#374151]">Announcement audio (optional)</p>
            <p className={pMuted}>
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
        </PersonalSection>
      ) : null}

      {incomingHandling !== "announcement_only" && showAnnouncementAudio ? (
        <PersonalSection title="Announcement audio">
          <p className={pMuted}>
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
        </PersonalSection>
      ) : null}

      {incomingHandling === "forward" ? (
        <PersonalSection title="Your forwarding setup">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-[#374151]">Forwarding</span>
              <button
                type="button"
                onClick={() => setForwardingOn((v) => !v)}
                className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                  forwardingOn
                    ? "bg-[#ecfdf5] text-[#059669]"
                    : "bg-[#f3f4f6] text-[#6b7280]"
                }`}
              >
                {forwardingOn ? "ON" : "OFF"}
              </button>
              <PersonalStatusBadge status={forwardingOn ? "active" : "inactive"} />
            </div>

            {forwardingOn ? (
              <>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Forward mode
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
                    {(
                      [
                        ["single", "Single destination"],
                        ["sequential", "Sequential — ring one after another"],
                        ["simultaneous", "Simultaneous — ring all together"],
                      ] as const
                    ).map(([mode, label]) => (
                      <label key={mode} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="forwardMode"
                          checked={forwardMode === mode}
                          onChange={() => setForwardMode(mode)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    Forward to
                  </p>
                  {targets.map((target, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="h-10 flex-1 max-w-md rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
                        placeholder={i === 0 ? "(571) 477-6175" : "Add another line"}
                        value={target}
                        onChange={(e) => updateTarget(i, e.target.value)}
                      />
                      {i > 0 ? (
                        <button
                          type="button"
                          className="text-[12px] text-[#6b7280]"
                          onClick={() => removeTarget(i)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {targets.length < 5 ? (
                    <button
                      type="button"
                      className="text-[13px] font-medium text-[#6366f1]"
                      onClick={addTarget}
                    >
                      + Add another line
                    </button>
                  ) : null}
                  <p className={pMuted}>
                    Sequential: Cell → Work → Voicemail. Simultaneous: Cell + Home ring together.
                  </p>
                </div>

                <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4 space-y-3">
                  <p className="text-[13px] font-semibold text-[#111827]">Ring time</p>
                  <div className="flex flex-wrap gap-2">
                    {FORWARD_RING_PRESETS.map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => {
                          setRingSeconds(sec);
                          setUseCustomRing(false);
                        }}
                        className={`rounded-lg px-3 py-1 text-[12px] ${
                          !useCustomRing && ringSeconds === sec
                            ? "bg-[#6366f1] text-white"
                            : "bg-white border border-[#e5e7eb]"
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setUseCustomRing(true)}
                      className={`rounded-lg px-3 py-1 text-[12px] ${
                        useCustomRing ? "bg-[#6366f1] text-white" : "bg-white border border-[#e5e7eb]"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
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

                <FallbackSelect
                  label="If not answered"
                  value={unansweredAction}
                  onChange={(v) => setUnansweredAction(v as "voicemail" | "end")}
                  options={[
                    ["voicemail", "Voicemail"],
                    ["end", "End call"],
                  ]}
                />
                <FallbackSelect
                  label="If busy"
                  value={busyAction}
                  onChange={(v) => setBusyAction(v as FallbackAction)}
                />
                {busyAction === "another_number" ? (
                  <input
                    className="mt-1 h-9 w-full max-w-md rounded-lg border border-[#e5e7eb] px-3 text-[13px]"
                    placeholder="Alternate number if busy"
                    value={busyNumber}
                    onChange={(e) => setBusyNumber(e.target.value)}
                  />
                ) : null}
                <FallbackSelect
                  label="If destination fails"
                  value={failedAction}
                  onChange={(v) => setFailedAction(v as FallbackAction)}
                />
                {failedAction === "another_number" ? (
                  <input
                    className="mt-1 h-9 w-full max-w-md rounded-lg border border-[#e5e7eb] px-3 text-[13px]"
                    placeholder="Alternate number if forwarding fails"
                    value={failedNumber}
                    onChange={(e) => setFailedNumber(e.target.value)}
                  />
                ) : null}

                <div className="rounded-lg border border-[#e5e7eb] p-4 space-y-3">
                  <p className="text-[13px] font-semibold">Incoming caller ID on your phone</p>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio"
                      checked={callerIdDisplay === "original"}
                      onChange={() => setCallerIdDisplay("original")}
                    />
                    Show original caller
                  </label>
                  <label className="flex items-center gap-2 text-[13px]">
                    <input
                      type="radio"
                      checked={callerIdDisplay === "transovo_number"}
                      onChange={() => setCallerIdDisplay("transovo_number")}
                    />
                    Show my Transovo number
                  </label>
                </div>

                <details className="rounded-lg border border-[#e5e7eb] p-4">
                  <summary className="text-[13px] font-semibold cursor-pointer">Advanced</summary>
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={callScreening}
                        onChange={(e) => setCallScreening(e.target.checked)}
                      />
                      Call screening — destination hears who is calling before accepting
                    </label>
                    <div className="space-y-3">
                      <p className="text-[13px] font-semibold">Schedule</p>
                      <label className="flex items-center gap-2 text-[13px]">
                        <input
                          type="radio"
                          checked={scheduleMode === "always"}
                          onChange={() => setScheduleMode("always")}
                        />
                        Always
                      </label>
                      <label className="flex items-center gap-2 text-[13px]">
                        <input
                          type="radio"
                          checked={scheduleMode === "custom"}
                          onChange={() => {
                            setScheduleMode("custom");
                            if (scheduleBlocks.length === 0) {
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
                        />
                        Custom schedule
                      </label>
                      {scheduleMode === "custom" ? (
                        <div className="mt-2 space-y-3 rounded-lg border border-[#e5e7eb] p-3">
                          <label className="text-[12px] text-[#6b7280]">
                            Timezone
                            <input
                              className="mt-1 h-9 w-full rounded-lg border border-[#e5e7eb] px-2 text-[13px]"
                              value={scheduleTimezone}
                              onChange={(e) => setScheduleTimezone(e.target.value)}
                            />
                          </label>
                          {scheduleBlocks.map((block, idx) => (
                            <div key={block.id} className="space-y-2 border-t border-[#f3f4f6] pt-2">
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
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="time"
                                  className="h-9 rounded-lg border border-[#e5e7eb] px-2 text-[13px]"
                                  value={block.startTime}
                                  onChange={(e) =>
                                    setScheduleBlocks((prev) =>
                                      prev.map((b) =>
                                        b.id === block.id
                                          ? { ...b, startTime: e.target.value }
                                          : b,
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
                                        b.id === block.id
                                          ? { ...b, endTime: e.target.value }
                                          : b,
                                      ),
                                    )
                                  }
                                />
                              </div>
                              <select
                                className="h-9 w-full rounded-lg border border-[#e5e7eb] px-2 text-[13px]"
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
                              </select>
                              {block.handling === "forward" ? (
                                <ScheduleTargetList
                                  targets={
                                    block.targets.length > 0 ? block.targets : targets.filter(Boolean)
                                  }
                                  onChange={(index, value) => updateBlockTarget(block.id, index, value)}
                                  onAdd={() => {
                                    if (block.targets.length === 0) {
                                      setScheduleBlocks((prev) =>
                                        prev.map((b) =>
                                          b.id === block.id
                                            ? { ...b, targets: targets.filter(Boolean).length ? [...targets.filter(Boolean)] : [""] }
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
                            className="text-[12px] font-medium text-[#6366f1]"
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
                            <p className="text-[12px] font-semibold mb-1">Outside schedule</p>
                            <select
                              className="h-9 w-full rounded-lg border border-[#e5e7eb] px-2 text-[13px]"
                              value={outsideHandling}
                              onChange={(e) =>
                                setOutsideHandling(
                                  e.target.value as typeof outsideHandling,
                                )
                              }
                            >
                              <option value="forward">Forward calls</option>
                              <option value="voicemail_only">Voicemail only</option>
                              <option value="announcement_only">Announcement only</option>
                            </select>
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
                      ) : null}
                    </div>
                  </div>
                </details>
              </>
            ) : null}
          </div>
        </PersonalSection>
      ) : null}

      <PersonalPrimaryButton onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </PersonalPrimaryButton>
      {message ? <p className="text-[12px] text-[#6b7280]">{message}</p> : null}

      <PersonalSection title="Call activity">
        <p className={pMuted}>
          View full call history on{" "}
          <Link href="/personal/activity" className="text-[#6366f1]">Call Activity</Link>.
        </p>
      </PersonalSection>
    </PersonalPageWrap>
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
          <input
            className="h-9 flex-1 rounded-lg border border-[#e5e7eb] px-2 text-[13px]"
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
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">{label}</p>
      <select
        className="mt-1 h-10 w-full max-w-md rounded-lg border border-[#e5e7eb] bg-white px-3 text-[14px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {list.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}
