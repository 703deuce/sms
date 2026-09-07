import { Loader2 } from "lucide-react";
import { useState } from "react";
import { detectMeetingPlatform, meetingPlatformLabel } from "../types";

type Props = {
  scheduled: boolean;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (values: {
    meetingUrl: string;
    title: string;
    date: string;
    time: string;
  }) => void;
};

export default function AddNotetakerForm({
  scheduled,
  busy,
  error,
  onCancel,
  onSubmit,
}: Props) {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [touched, setTouched] = useState(false);

  const detected = detectMeetingPlatform(meetingUrl);
  const showDetected = meetingUrl.trim().length > 6 && detected !== "unsupported";
  const showUnsupported = meetingUrl.trim().length > 6 && detected === "unsupported";
  const urlInvalid = touched && !meetingUrl.trim();

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }} className="font-display">
        {scheduled ? "Schedule AI Notetaker" : "Add AI Notetaker"}
      </h2>
      <p
        style={{
          fontSize: 13,
          color: "var(--muted-foreground)",
          margin: "6px 0 20px",
          lineHeight: 1.55,
        }}
      >
        {scheduled
          ? "Choose when Transovo should join. The notetaker will arrive a few minutes before the start time."
          : "Transovo will join the meeting now and begin recording and transcribing."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
        <div>
          <label className="label" htmlFor="meeting-url">
            Meeting link
          </label>
          <input
            id="meeting-url"
            className={`input ${urlInvalid || showUnsupported ? "input-error" : ""}`}
            placeholder="https://zoom.us/j/…"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={urlInvalid || showUnsupported}
            aria-describedby="meeting-url-hint"
            autoFocus
          />
          {showDetected ? (
            <p id="meeting-url-hint" style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "6px 0 0" }}>
              Detected: {meetingPlatformLabel(detected as never)}
            </p>
          ) : null}
          {showUnsupported ? (
            <p id="meeting-url-hint" role="alert" className="text-red-600" style={{ fontSize: 12, margin: "6px 0 0" }}>
              Enter a valid Zoom, Google Meet, Microsoft Teams, or Webex link.
            </p>
          ) : null}
          {urlInvalid ? (
            <p role="alert" className="text-red-600" style={{ fontSize: 12, margin: "6px 0 0" }}>
              Meeting URL is required.
            </p>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="meeting-title">
            Title <span style={{ fontWeight: 400, color: "var(--muted-foreground)" }}>— Optional</span>
          </label>
          <input
            id="meeting-title"
            className="input"
            placeholder="e.g. Discovery call — Anthony Johnson"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {scheduled ? (
          <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="label" htmlFor="meeting-date">
                Date
              </label>
              <input
                id="meeting-date"
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="meeting-time">
                Time
              </label>
              <input
                id="meeting-time"
                type="time"
                className="input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-red-600" style={{ fontSize: 13, margin: "14px 0 0" }}>
          {error}
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button
          className="btn btn-primary"
          disabled={busy || showUnsupported}
          onClick={() => onSubmit({ meetingUrl, title, date, time })}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : null}
          {scheduled ? "Schedule notetaker" : "Add notetaker"}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
