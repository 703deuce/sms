"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, Button, Input, Label, Select } from "./ui";
import { MeetingPoll } from "../mock-data";

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
  onCreate: (poll: MeetingPoll) => void;
}) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("30");
  const [location, setLocation] = useState("Zoom");
  const [options, setOptions] = useState<DraftOption[]>([
    defaultOption(1, 10),
    defaultOption(2, 14),
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateOption = (i: number, patch: Partial<DraftOption>) =>
    setOptions((opts) => opts.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const removeOption = (i: number) =>
    setOptions((opts) => opts.filter((_, idx) => idx !== i));

  const canSubmit =
    title.trim().length > 0 &&
    options.length >= 2 &&
    options.every((o) => o.date && o.time);

  async function submit() {
    if (!canSubmit) {
      setError("Add a title and at least two time options.");
      return;
    }
    setSaving(true);
    setError("");
    // Simulate POST /api/appointments/meeting-polls
    await new Promise((r) => setTimeout(r, 600));
    const durMs = Number(duration) * 60000;
    const poll: MeetingPoll = {
      id: `poll_${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
      closesAt: null,
      location,
      durationMinutes: Number(duration),
      organizer: "You",
      invitees: 0,
      responded: 0,
      shareUrl: `https://book.transovo.com/p/${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`,
      options: options.map((o, i) => {
        const start = new Date(`${o.date}T${o.time}:00`);
        return {
          id: `new_o${i}`,
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + durMs).toISOString(),
          votes: 0,
        };
      }),
    };
    setSaving(false);
    onCreate(poll);
  }

  return (
    <Modal
      title="New meeting poll"
      subtitle="Propose a few times and let invitees vote on what works best."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!title.trim() || saving}>
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

      <div className="field-row">
        <div className="field">
          <Label htmlFor="poll-duration">Duration</Label>
          <Select id="poll-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
          </Select>
        </div>
        <div className="field">
          <Label htmlFor="poll-location">Location</Label>
          <Select id="poll-location" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option>Zoom</option>
            <option>Google Meet</option>
            <option>Microsoft Teams</option>
            <option>Phone call</option>
            <option>In person</option>
          </Select>
        </div>
      </div>

      <div className="field">
        <Label>Time options</Label>
        <p className="hint" style={{ margin: "-2px 0 10px" }}>
          Add at least two proposed times. Times are shown in your workspace timezone (Eastern Time).
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
            <div className="alert-title">Couldn't create poll</div>
            {error}
          </div>
        </div>
      )}
    </Modal>
  );
}
