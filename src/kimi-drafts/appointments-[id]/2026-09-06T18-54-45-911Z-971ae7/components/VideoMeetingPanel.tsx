"use client";

import { useState } from "react";
import { Copy, Video } from "lucide-react";
import { Button, Card, StatusBadge } from "./ui";
import { videoMeeting } from "../mock-data";

export function VideoMeetingPanel({ onCopied }: { onCopied: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyGuestLink() {
    try {
      await navigator.clipboard.writeText(videoMeeting.guestUrl);
    } catch {
      /* clipboard unavailable in sandbox */
    }
    setCopied(true);
    onCopied();
    setTimeout(() => setCopied(false), 2000);
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
        <StatusBadge status="scheduled" label="Scheduled" />
        <span className="muted small">Up to {videoMeeting.maxParticipants} participants</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button size="sm">
          <Video size={13} /> Join as host
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copyGuestLink()}>
          <Copy size={13} /> {copied ? "Copied" : "Copy guest link"}
        </Button>
      </div>
      <p className="muted small" style={{ marginBottom: 0, marginTop: 12 }}>
        Customers receive the join link automatically in confirmation and reminder messages.
      </p>
      <hr className="section-divider" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
        <span className="muted">Recording</span>
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{videoMeeting.recordingMode}</span>
        <span className="muted">AI recap</span>
        <span style={{ fontWeight: 600 }}>{videoMeeting.aiRecapEnabled ? "On" : "Off"}</span>
      </div>
    </Card>
  );
}
