"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, Button, Input, Label, Select } from "./ui";
import type { MeetingPollUi } from "@/lib/appointments/meeting-polls-present";

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
  onCreate: (poll: MeetingPollUi) => void;
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

  function submit() {
    if (!canSubmit) {
      setError("Add a title and at least two time options.");
      return;
    }
    setSaving(true);
    setError("");
    const durMs = Number(duration) * 60000;
    const pollOptions = options.map((o, i) => {
      const start = new Date(`${o.date}T${o.time}:00`);
      return {
        id: `new_o${i}`,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + durMs).toISOString(),
        votes: 0,
      };
    });
    onCreate({
      id: "",
      title: title.trim(),
      status: "open",
      createdAt: new Date().toISOString(),
      closesAt: null,
      location,
      durationMinutes: Number(duration),
      organizer: "You",
      invitees: 0,
      responded: 0,
      shareUrl: "",
      options: pollOptions,
    });
    setSaving(false);
  }

  return (
    <Modal title="Create meeting poll" onClose={onClose}>
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <Label htmlFor="poll-title">Poll title</Label>
          <Input
            id="poll-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project kickoff"
          />
        </div>

        <div className="field-grid">
          <div>
            <Label htmlFor="poll-duration">Duration (minutes)</Label>
            <Select id="poll-duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
              {["15", "30", "45", "60", "90"].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="poll-location">Meeting method</Label>
            <Select id="poll-location" value={location} onChange={(e) => setLocation(e.target.value)}>
              {["Zoom", "Google Meet", "Microsoft Teams", "Transovo Video", "In person", "Phone"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Proposed times</Label>
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            {options.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input type="date" value={o.date} onChange={(e) => updateOption(i, { date: e.target.value })} aria-label={`Date option ${i + 1}`} />
                <Input type="time" value={o.time} onChange={(e) => updateOption(i, { time: e.target.value })} aria-label={`Time option ${i + 1}`} />
                {options.length > 2 && (
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" style={{ marginTop: 8 }} onClick={() => setOptions((opts) => [...opts, defaultOption(opts.length + 1, 10)])}>
            <Plus size={14} /> Add time
          </Button>
        </div>

        {error ? <p className="field-error" role="alert">{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving ? "Creating…" : "Create poll"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
