"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, Button, Input, Label, Select } from "./ui";
import type { MeetingTypeOption } from "../types";

type DraftOption = { date: string; time: string };

function defaultOption(offsetDays: number, hour: number): DraftOption {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(hour).padStart(2, "0")}:00`,
  };
}

export function CreatePollModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    appointmentTypeId: string;
    options: Array<{ startsAt: string; endsAt: string }>;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [appointmentTypeId, setAppointmentTypeId] = useState("");
  const [meetingTypes, setMeetingTypes] = useState<MeetingTypeOption[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [options, setOptions] = useState<DraftOption[]>([
    defaultOption(1, 10),
    defaultOption(2, 14),
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTypesLoading(true);
    fetch("/api/appointments/meeting-polls?eligibleMeetingTypes=1")
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data || []) as MeetingTypeOption[];
        setMeetingTypes(rows);
        if (rows[0]) setAppointmentTypeId(rows[0].id);
      })
      .catch(() => setMeetingTypes([]))
      .finally(() => setTypesLoading(false));
  }, []);

  const selectedType = meetingTypes.find((t) => t.id === appointmentTypeId);
  const durationMinutes = selectedType?.durationMinutes || 30;

  const updateOption = (i: number, patch: Partial<DraftOption>) =>
    setOptions((opts) => opts.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const removeOption = (i: number) =>
    setOptions((opts) => opts.filter((_, idx) => idx !== i));

  const canSubmit =
    title.trim().length > 0 &&
    appointmentTypeId &&
    options.length >= 2 &&
    options.every((o) => o.date && o.time);

  async function submit() {
    if (!canSubmit) {
      setError("Add a title, meeting type, and at least two time options.");
      return;
    }
    setSaving(true);
    setError("");
    const durMs = durationMinutes * 60000;
    try {
      await onCreate({
        title: title.trim(),
        appointmentTypeId,
        options: options.map((o) => {
          const start = new Date(`${o.date}T${o.time}:00`);
          return {
            startsAt: start.toISOString(),
            endsAt: new Date(start.getTime() + durMs).toISOString(),
          };
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create poll.");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New meeting poll"
      subtitle="Propose a few times and let invitees vote on what works best."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || saving || typesLoading}>
            {saving ? "Creating…" : "Create poll"}
          </Button>
        </>
      }
    >
      <div className="field">
        <Label htmlFor="poll-title">Poll title</Label>
        <Input
          id="poll-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Team sync times"
        />
      </div>

      <div className="field">
        <Label htmlFor="poll-meeting-type">Meeting type</Label>
        {typesLoading ? (
          <p className="hint">Loading meeting types…</p>
        ) : meetingTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#ecedf2] px-3 py-3 text-[12.5px] text-[#8a8fa3]">
            <p className="mb-2">No Meeting Types are available to you.</p>
            <a href="/appointments/types" className="text-[#147d74] font-medium hover:underline">
              View booking types
            </a>
          </div>
        ) : (
          <Select
            id="poll-meeting-type"
            value={appointmentTypeId}
            onChange={(e) => setAppointmentTypeId(e.target.value)}
          >
            {meetingTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} ({type.durationMinutes} min)
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="field">
        <Label>Time options</Label>
        <p className="hint" style={{ margin: "-2px 0 10px" }}>
          Add at least two proposed times. Duration follows the selected meeting type ({durationMinutes} min).
        </p>
        {options.map((o, i) => (
          <div className="option-row" key={i}>
            <Input
              type="date"
              aria-label={`Option ${i + 1} date`}
              value={o.date}
              onChange={(e) => updateOption(i, { date: e.target.value })}
            />
            <Input
              type="time"
              aria-label={`Option ${i + 1} start time`}
              value={o.time}
              onChange={(e) => updateOption(i, { time: e.target.value })}
            />
            <button
              className="icon-btn"
              aria-label={`Remove option ${i + 1}`}
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-option"
          onClick={() => setOptions((opts) => [...opts, defaultOption(opts.length + 2, 9 + opts.length)])}
        >
          <Plus size={14} /> Add another time
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <div>
            <div className="alert-title">Couldn&apos;t create poll</div>
            {error}
          </div>
        </div>
      )}
    </Modal>
  );
}
