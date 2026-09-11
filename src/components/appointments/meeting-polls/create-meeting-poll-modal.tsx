"use client";

import { useState } from "react";
import { wallTimeInZoneToUtc } from "@/lib/voice/calendar/timezone-slots";

type Step = 1 | 2 | 3;

type TimeRow = { date: string; start: string };

function buildIso(timezone: string, date: string, start: string, durationMinutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = start.split(":").map(Number);
  const startUtc = wallTimeInZoneToUtc(timezone, y, m, d, hh, mm);
  const endUtc = new Date(startUtc.getTime() + durationMinutes * 60_000);
  return { startsAt: startUtc.toISOString(), endsAt: endUtc.toISOString() };
}

export function CreateMeetingPollModal({
  workspaceSlug,
  onClose,
  onCreated,
}: {
  workspaceSlug: string;
  onClose: () => void;
  onCreated: (pollId: string) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York",
  );
  const [meetingMethod, setMeetingMethod] = useState<"video" | "phone" | "in_person">("video");
  const [timeRows, setTimeRows] = useState<TimeRow[]>([{ date: "", start: "10:00" }]);
  const [participants, setParticipants] = useState<Array<{ name: string; email: string }>>([
    { name: "", email: "" },
  ]);
  const [deadlineAt, setDeadlineAt] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const options = timeRows
      .filter((r) => r.date && r.start)
      .map((r) => buildIso(timezone, r.date, r.start, duration));
    if (!options.length) {
      setError("Add at least one time option");
      return;
    }
    const parts = participants.filter((p) => p.email.trim());
    setSaving(true);
    try {
      const res = await fetch("/api/appointments/meeting-polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          durationMinutes: duration,
          timezone,
          meetingMethod,
          deadlineAt: deadlineAt || undefined,
          options,
          participants: parts,
          openImmediately: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      onCreated(json.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[var(--surface)] p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Create meeting poll — step {step} of 3</h2>
          <button type="button" className="text-xs text-[var(--text-muted)]" onClick={onClose}>Close</button>
        </div>

        {step === 1 && (
          <div className="mt-4 space-y-3 text-xs">
            <label className="block">
              <span className="ws-field-label">Poll title</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="block">
              <span className="ws-field-label">Description</span>
              <textarea className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="block">
              <span className="ws-field-label">Duration (minutes)</span>
              <select className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
              </select>
            </label>
            <label className="block">
              <span className="ws-field-label">Timezone</span>
              <input className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </label>
            <label className="block">
              <span className="ws-field-label">Meeting method</span>
              <select className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={meetingMethod} onChange={(e) => setMeetingMethod(e.target.value as typeof meetingMethod)}>
                <option value="video">Video</option>
                <option value="phone">Phone</option>
                <option value="in_person">In person</option>
              </select>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 space-y-2 text-xs">
            {timeRows.map((row, idx) => (
              <div key={idx} className="flex gap-2">
                <input type="date" className="flex-1 rounded border border-[var(--border)] px-2 py-1.5" value={row.date} onChange={(e) => {
                  const next = [...timeRows];
                  next[idx] = { ...row, date: e.target.value };
                  setTimeRows(next);
                }} />
                <input type="time" className="w-28 rounded border border-[var(--border)] px-2 py-1.5" value={row.start} onChange={(e) => {
                  const next = [...timeRows];
                  next[idx] = { ...row, start: e.target.value };
                  setTimeRows(next);
                }} />
                <button type="button" className="text-[var(--text-muted)]" onClick={() => setTimeRows(timeRows.filter((_, i) => i !== idx))}>Remove</button>
              </div>
            ))}
            <button type="button" className="text-[var(--accent)]" onClick={() => setTimeRows([...timeRows, { date: timeRows[timeRows.length - 1]?.date || "", start: "14:00" }])}>
              + Add time
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-3 text-xs">
            {participants.map((p, idx) => (
              <div key={idx} className="flex gap-2">
                <input placeholder="Name" className="flex-1 rounded border border-[var(--border)] px-2 py-1.5" value={p.name} onChange={(e) => {
                  const next = [...participants];
                  next[idx] = { ...p, name: e.target.value };
                  setParticipants(next);
                }} />
                <input placeholder="Email" className="flex-1 rounded border border-[var(--border)] px-2 py-1.5" value={p.email} onChange={(e) => {
                  const next = [...participants];
                  next[idx] = { ...p, email: e.target.value };
                  setParticipants(next);
                }} />
              </div>
            ))}
            <button type="button" className="text-[var(--accent)]" onClick={() => setParticipants([...participants, { name: "", email: "" }])}>
              + Add participant
            </button>
            <label className="block">
              <span className="ws-field-label">Response deadline (optional)</span>
              <input type="datetime-local" className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} />
            </label>
            {workspaceSlug && (
              <p className="text-[var(--text-muted)]">After creation you can copy a secure share link for guests.</p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}

        <div className="mt-4 flex justify-between gap-2">
          <button type="button" className="appt-pilot-secondary-btn" disabled={step === 1} onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}>
            Back
          </button>
          {step < 3 ? (
            <button type="button" className="appt-pilot-primary-btn" onClick={() => setStep((s) => ((s + 1) as Step))}>
              Continue
            </button>
          ) : (
            <button type="button" className="appt-pilot-primary-btn" disabled={saving} onClick={() => void submit()}>
              {saving ? "Creating…" : "Open poll"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
