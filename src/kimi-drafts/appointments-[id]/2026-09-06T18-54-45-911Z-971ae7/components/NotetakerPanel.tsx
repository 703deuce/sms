"use client";

import { Sparkles, ExternalLink } from "lucide-react";
import { Button, Card, StatusBadge } from "./ui";
import { meetingSession } from "../mock-data";

export function NotetakerPanel() {
  return (
    <Card
      title={
        <>
          <Sparkles size={15} className="muted" /> AI Notetaker
        </>
      }
      sub="Transovo joins the call and prepares a recap"
    >
      <div className="info-list">
        <div className="info-row">
          <span className="info-label">Platform</span>
          <span className="info-value">Zoom</span>
        </div>
        <div className="info-row">
          <span className="info-label">Status</span>
          <span className="info-value">
            <StatusBadge status="scheduled" label="Scheduled — joins automatically" />
          </span>
        </div>
      </div>
      <div
        className="banner"
        style={{ borderColor: "#bfd7fa", background: "#eff4ff", marginTop: 12 }}
      >
        <span className="banner-body">
          <div className="banner-text" style={{ color: "#175cd3" }}>
            AI Notetaker was added automatically for this appointment.
          </div>
        </span>
      </div>
      <div style={{ marginTop: 12 }}>
        <Button size="sm" variant="outline" asChild={false} onClick={() => window.open(meetingSession.meetingUrl, "_blank")}>
          <ExternalLink size={13} /> Open meeting link
        </Button>
      </div>
    </Card>
  );
}
