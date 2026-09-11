"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck, Copy } from "lucide-react";
import { useMeetingPollDetail } from "@/features/appointments/kimi/meeting-polls/use-meeting-polls-workspace";
import type { MeetingPollVoteValue } from "@/lib/appointments/scheduling-capabilities";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "options", label: "Time options" },
  { id: "participants", label: "Participants" },
  { id: "responses", label: "Responses" },
  { id: "finalize", label: "Finalize" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function fmt(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function voteSymbol(v: MeetingPollVoteValue | undefined) {
  if (v === "yes") return "✓";
  if (v === "maybe") return "?";
  if (v === "no") return "✕";
  return "·";
}

export function MeetingPollDetailConnected({ pollId }: { pollId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as SectionId) || "overview";
  const detail = useMeetingPollDetail(pollId);
  const [finalizeOptionId, setFinalizeOptionId] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState("");
  const [toast, setToast] = useState("");

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/meeting-polls/${pollId}?${q.toString()}`, { scroll: false });
    },
    [router, searchParams, pollId],
  );

  const detailData = detail.data;
  const poll = detailData?.poll;
  const scoreboard = detailData?.scoreboard;

  const activeOptions = useMemo(
    () => poll?.options.filter((o) => !o.archivedAt) || [],
    [poll],
  );

  const responseMap = useMemo(() => {
    const m = new Map<string, MeetingPollVoteValue>();
    if (!poll) return m;
    for (const r of poll.responses) m.set(`${r.participantId}:${r.optionId}`, r.value);
    return m;
  }, [poll]);

  async function copyLink() {
    if (!detail.data?.publicUrl) return;
    await navigator.clipboard.writeText(detail.data.publicUrl);
    setToast("Poll link copied");
  }

  async function finalize(force = false) {
    const optionId = finalizeOptionId || scoreboard?.bestOptionId;
    if (!optionId) return;
    setFinalizeError("");
    try {
      const key = `finalize:${pollId}:${optionId}`;
      await detail.runAction({
        action: "finalize",
        optionId,
        idempotencyKey: key,
        forceDespiteConflicts: force,
      });
      setToast("Meeting finalized");
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : "Finalization failed");
    }
  }

  if (detail.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] h-40 animate-pulse rounded bg-[var(--surface)]" />
      </div>
    );
  }

  if (!poll || !scoreboard) {
    return (
      <div className={`${SHELL} p-8 text-sm`}>
        {detail.error || "Poll not found"}{" "}
        <Link href="/appointments/meeting-polls" className="text-[var(--accent)]">Back</Link>
      </div>
    );
  }

  const participants = poll.participants.filter((p) => p.status !== "removed");
  const responded = new Set(poll.responses.map((r) => r.participantId));
  const bestTally = scoreboard.tallies.find((t) => t.isBest);

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href="/appointments/meeting-polls" className="text-xs text-[var(--accent)]">← Meeting Polls</Link>
              <div className="mt-1 flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-[var(--accent)]" />
                <h1 className="ws-event-title truncate">{poll.title}</h1>
                <span className="ws-chip">{detailData!.derivedStatus}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="appt-pilot-secondary-btn text-xs" onClick={() => void copyLink()}>
                <Copy className="mr-1 inline h-3.5 w-3.5" /> Copy poll link
              </button>
              {poll.bookedAppointmentId && (
                <Link href={`/appointments/calendar?appointmentId=${poll.bookedAppointmentId}`} className="appt-pilot-primary-btn text-xs">
                  Open Meeting
                </Link>
              )}
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-1 border-t border-[var(--border)] pt-2" aria-label="Poll sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`rounded-md px-2 py-1 text-xs ${section === s.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="p-4 lg:p-6 text-xs">
          {section === "overview" && (
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <div className="font-medium">Poll status</div>
                <p className="mt-1 text-[var(--text-muted)]">{detailData!.derivedStatus}</p>
                {poll.deadlineAt && <p className="mt-1">Deadline: {fmt(poll.deadlineAt, poll.timezone)}</p>}
                {detailData!.derivedStatus === "open" && (
                  <button type="button" className="mt-2 text-[var(--accent)]" onClick={() => void detail.runAction({ action: "close" })}>
                    Close poll
                  </button>
                )}
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <div className="font-medium">Response progress</div>
                <p className="mt-1">{responded.size} / {participants.length} responded</p>
                <div className="mt-2 h-1.5 rounded bg-[var(--surface-muted)]">
                  <div
                    className="h-full rounded bg-[var(--accent)]"
                    style={{ width: `${participants.length ? (responded.size / participants.length) * 100 : 0}%` }}
                  />
                </div>
                <button type="button" className="mt-2 text-[var(--accent)]" onClick={() => void detail.runAction({ action: "remind" })}>
                  Remind non-responders
                </button>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <div className="font-medium">Current best</div>
                {bestTally && (
                  <>
                    <p className="mt-1">{fmt(activeOptions.find((o) => o.id === bestTally.optionId)?.startsAt || "", poll.timezone)}</p>
                    <p className="text-[var(--text-muted)]">{bestTally.yes} yes · {bestTally.maybe} maybe · {bestTally.no} no</p>
                    <span className="mt-1 inline-block rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[var(--accent)]">Best match</span>
                  </>
                )}
              </div>
            </div>
          )}

          {section === "options" && (
            <table className="w-full overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2">Yes</th>
                  <th className="px-3 py-2">Maybe</th>
                  <th className="px-3 py-2">No</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeOptions.map((opt) => {
                  const t = scoreboard.tallies.find((x) => x.optionId === opt.id);
                  return (
                    <tr key={opt.id} className={`border-b border-[var(--border)] ${t?.isBest ? "bg-[var(--accent-soft)]/40" : ""}`}>
                      <td className="px-3 py-2">{fmt(opt.startsAt, poll.timezone).split(",")[0]}</td>
                      <td className="px-3 py-2">{fmt(opt.startsAt, poll.timezone)}</td>
                      <td className="px-3 py-2 text-center">{t?.yes ?? 0}</td>
                      <td className="px-3 py-2 text-center">{t?.maybe ?? 0}</td>
                      <td className="px-3 py-2 text-center">{t?.no ?? 0}</td>
                      <td className="px-3 py-2 text-center">{t?.score ?? 0}</td>
                      <td className="px-3 py-2">{t?.isBest ? "Best" : "Open"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {section === "participants" && (
            <table className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Participant</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2">Response</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">{p.email}</td>
                    <td className="px-3 py-2">{responded.has(p.id) ? "Complete" : "Waiting"}</td>
                    <td className="px-3 py-2">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === "responses" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
              <table className="min-w-full text-center">
                <thead>
                  <tr className="text-[var(--text-muted)]">
                    <th className="sticky left-0 bg-[var(--surface)] px-2 py-1 text-left">Participant</th>
                    {activeOptions.map((o) => {
                      const t = scoreboard.tallies.find((x) => x.optionId === o.id);
                      return (
                        <th key={o.id} className={`px-2 py-1 ${t?.isBest ? "ring-1 ring-[var(--accent)]" : ""}`}>
                          {new Intl.DateTimeFormat("en-US", { timeZone: poll.timezone, weekday: "short", hour: "numeric" }).format(new Date(o.startsAt))}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--border)]">
                      <td className="sticky left-0 bg-[var(--surface)] px-2 py-1 text-left">{p.name}</td>
                      {activeOptions.map((o) => (
                        <td key={o.id} className="px-2 py-1" aria-label={`${p.name} ${voteSymbol(responseMap.get(`${p.id}:${o.id}`))}`}>
                          {voteSymbol(responseMap.get(`${p.id}:${o.id}`))}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--border)] font-medium">
                    <td className="sticky left-0 bg-[var(--surface)] px-2 py-1 text-left">TOTAL YES</td>
                    {activeOptions.map((o) => {
                      const t = scoreboard.tallies.find((x) => x.optionId === o.id);
                      return <td key={o.id} className="px-2 py-1">{t?.yes ?? 0}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {section === "finalize" && (
            <div className="max-w-xl rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="font-medium">Finalize into Meeting</div>
              <label className="mt-3 block">
                <span className="ws-field-label">Selected time</span>
                <select
                  className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5"
                  value={finalizeOptionId || scoreboard.bestOptionId || ""}
                  onChange={(e) => setFinalizeOptionId(e.target.value)}
                >
                  {activeOptions.map((o) => (
                    <option key={o.id} value={o.id}>{fmt(o.startsAt, poll.timezone)}</option>
                  ))}
                </select>
              </label>
              {bestTally && (
                <p className="mt-2 text-[var(--text-muted)]">
                  Votes: {bestTally.yes} yes · {bestTally.maybe} maybe · {bestTally.no} no
                </p>
              )}
              {finalizeError && (
                <p className="mt-2 text-red-600" role="alert">
                  {finalizeError}{" "}
                  <button type="button" className="underline" onClick={() => void finalize(true)}>Finalize anyway</button>
                </p>
              )}
              {poll.status !== "finalized" && (
                <button type="button" className="appt-pilot-primary-btn mt-4" onClick={() => void finalize(false)}>
                  Finalize meeting
                </button>
              )}
              {poll.bookedAppointmentId && (
                <p className="mt-3 text-[var(--accent)]">Meeting created: {poll.bookedAppointmentId}</p>
              )}
            </div>
          )}

          {section === "activity" && (
            <table className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {(poll.activity || []).map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{new Date(a.at).toLocaleString()}</td>
                    <td className="px-3 py-2">{a.actor}</td>
                    <td className="px-3 py-2">{a.action}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === "settings" && (
            <div className="max-w-md space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p>Timezone: {poll.timezone}</p>
              <p>Duration: {poll.durationMinutes} minutes</p>
              <p>Allow maybe: {poll.settings.allowMaybe ? "Yes" : "No"}</p>
              <p>Allow response changes: {poll.settings.allowResponseChanges ? "Yes" : "No"}</p>
              <button type="button" className="text-red-600" onClick={() => void detail.runAction({ action: "cancel" })}>
                Cancel poll
              </button>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-4 right-4 rounded bg-[var(--surface)] px-3 py-2 text-xs shadow" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
