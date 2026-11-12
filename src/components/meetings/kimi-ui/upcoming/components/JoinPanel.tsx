import { Mic, MicOff, Video, VideoOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  formatMeetingDate,
  meetingPlatformLabel,
  type UpcomingSession,
} from "../types";

type Props = {
  session: UpcomingSession;
  onClose: () => void;
};

/**
 * Transovo Video join panel — host pre-join surface for Transovo-hosted
 * video meetings (appt-video-panel / meetings-host-join).
 */
export default function JoinPanel({ session, onClose }: Props) {
  const router = useRouter();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [joining, setJoining] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management: move focus into dialog, restore on close
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  function join() {
    setJoining(true);
    const target =
      session.hostJoinUrl ||
      (session.appointmentId ? `/appointments/${session.appointmentId}/video/host` : session.meetingUrl);
    if (target.startsWith("http")) {
      window.location.href = target;
      return;
    }
    router.push(target);
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-panel-title"
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2
              id="join-panel-title"
              className="font-display"
              style={{ fontSize: 17, fontWeight: 700, margin: 0 }}
            >
              {session.title || "Video meeting"}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--muted-foreground)",
                margin: "5px 0 0",
              }}
            >
              {meetingPlatformLabel(session.meetingPlatform)} ·{" "}
              {formatMeetingDate(session.scheduledStartAt)}
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label="Close join panel"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Camera preview placeholder */}
        <div className="video-preview" aria-label="Camera preview">
          {camOn ? (
            <span style={{ fontSize: 13, color: "#cbd2e1" }}>
              Camera preview
            </span>
          ) : (
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                color: "#cbd2e1",
              }}
            >
              <VideoOff size={22} />
              <span style={{ fontSize: 13 }}>Camera is off</span>
            </span>
          )}
        </div>

        {/* Device toggles */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            type="button"
            className={`device-btn ${micOn ? "" : "device-btn-off"}`}
            aria-pressed={micOn}
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            onClick={() => setMicOn((v) => !v)}
          >
            {micOn ? <Mic size={17} /> : <MicOff size={17} />}
          </button>
          <button
            type="button"
            className={`device-btn ${camOn ? "" : "device-btn-off"}`}
            aria-pressed={camOn}
            aria-label={camOn ? "Turn camera off" : "Turn camera on"}
            onClick={() => setCamOn((v) => !v)}
          >
            {camOn ? <Video size={17} /> : <VideoOff size={17} />}
          </button>
        </div>

        {session.participants?.length ? (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--muted-foreground)",
              margin: 0,
              textAlign: "center",
            }}
          >
            {session.participants.join(" · ")}
          </p>
        ) : null}

        {/* Recording / consent notice (Privacy & Consent standards) */}
        <p
          style={{
            fontSize: 12,
            color: "var(--muted-foreground)",
            background: "var(--background)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "8px 12px",
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          An AI Notetaker may join this meeting to record, transcribe, and
          prepare meeting notes. Participants are notified in advance.
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, height: 40 }}
            onClick={join}
            disabled={joining}
            data-autofocus
          >
            <Video size={15} />
            {joining ? "Joining…" : "Join as host"}
          </button>
          <button className="btn btn-outline" style={{ height: 40 }} onClick={onClose} disabled={joining}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
