"use client";

import { useEffect, useState } from "react";
import { Copy, Video, VideoOff } from "lucide-react";
import { Button, Card, StatusBadge } from "./ui";

type VideoMeetingRow = {
  id: string;
  publicMeetingToken: string;
  title: string | null;
  status: string;
  maxParticipants: number;
  recordingMode: string;
  aiRecapEnabled: boolean;
  meetingUrl?: string;
};

export function VideoMeetingPanel({
  appointmentId,
  provisioned = true,
  onCopied,
}: {
  appointmentId: string;
  provisioned?: boolean;
  onCopied: () => void;
}) {
  const [meeting, setMeeting] = useState<VideoMeetingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitled, setEntitled] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/appointments/${appointmentId}/video`)
      .then((r) => {
        if (r.status === 403) {
          setEntitled(false);
          return null;
        }
        return r.json();
      })
      .then((json) => {
        if (json) setMeeting(json.data?.meeting || null);
      })
      .finally(() => setLoading(false));
  }, [appointmentId]);

  async function copyGuestLink() {
    const url = meeting?.meetingUrl || "";
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    onCopied();
    setTimeout(() => setCopied(false), 2000);
  }

  if (!entitled) return null;

  if (loading) {
    return (
      <Card title={<><Video size={15} className="muted" /> Transovo Video</>}>
        <p className="muted small" style={{ margin: 0 }}>Loading video meeting…</p>
      </Card>
    );
  }

  if (!provisioned || !meeting) {
    return (
      <Card
        title={
          <>
            <VideoOff size={15} className="muted" /> Transovo Video
          </>
        }
      >
        <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
          No video room is linked to this appointment. Transovo Video isn&apos;t provisioned
          for this booking type — enable it in the booking type&apos;s settings to automatically
          create a room for future bookings.
        </p>
        <Button size="sm" variant="outline" style={{ marginTop: 12 }} onClick={() => onCopied()}>
          Set up Transovo Video
        </Button>
      </Card>
    );
  }

  return (
    <Card
      title={
        <>
          <Video size={15} className="muted" /> Transovo Video
        </>
      }
      sub="A video room is linked to this appointment"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <StatusBadge status={meeting.status || "scheduled"} label="Scheduled" />
        <span className="muted small">Up to {meeting.maxParticipants} participants</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {meeting.meetingUrl ? (
          <Button size="sm" onClick={() => window.open(meeting.meetingUrl, "_blank")}>
            <Video size={13} /> Join as host
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => void copyGuestLink()} disabled={!meeting.meetingUrl}>
          <Copy size={13} /> {copied ? "Copied" : "Copy guest link"}
        </Button>
      </div>
      <p className="muted small" style={{ marginBottom: 0, marginTop: 12 }}>
        Customers receive the join link automatically in confirmation and reminder messages.
      </p>
      <hr className="section-divider" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
        <span className="muted">Recording</span>
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{meeting.recordingMode}</span>
        <span className="muted">AI recap</span>
        <span style={{ fontWeight: 600 }}>{meeting.aiRecapEnabled ? "On" : "Off"}</span>
      </div>
    </Card>
  );
}
