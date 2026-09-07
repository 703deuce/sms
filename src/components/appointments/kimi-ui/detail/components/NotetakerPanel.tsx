"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { Button, Card, StatusBadge } from "./ui";
import { meetingPlatformLabel } from "@/lib/meeting-assistant/platform";

type MeetingSessionRow = {
  id: string;
  title: string | null;
  status: string;
  meetingPlatform: string;
  meetingUrl: string;
};

export function NotetakerPanel({ appointmentId }: { appointmentId: string }) {
  const [session, setSession] = useState<MeetingSessionRow | null>(null);
  const [resolvedMeetingUrl, setResolvedMeetingUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/meetings`);
      const json = await res.json();
      const external = json.data?.externalSession as MeetingSessionRow | null;
      setSession(external);
      setResolvedMeetingUrl(String(json.data?.resolvedMeetingUrl || ""));
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const meetingUrl = session?.meetingUrl || resolvedMeetingUrl;

  if (loading) {
    return (
      <Card title={<><Sparkles size={15} className="muted" /> AI Notetaker</>}>
        <p className="muted small" style={{ margin: 0 }}>Loading notetaker…</p>
      </Card>
    );
  }

  if (!session && !meetingUrl) {
    return (
      <Card
        title={
          <>
            <Sparkles size={15} className="muted" /> AI Notetaker
          </>
        }
        sub="Transovo joins the call and prepares a recap"
      >
        <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
          No meeting link is linked to this appointment yet. Add a Zoom or Google Meet link to enable AI Notetaker.
        </p>
      </Card>
    );
  }

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
          <span className="info-value">
            {session?.meetingPlatform
              ? meetingPlatformLabel(session.meetingPlatform as import("@/lib/meeting-assistant/types").MeetingPlatform)
              : "External"}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Status</span>
          <span className="info-value">
            <StatusBadge
              status={session?.status || "scheduled"}
              label={session?.status ? undefined : "Scheduled — joins automatically"}
            />
          </span>
        </div>
      </div>
      {meetingUrl ? (
        <div style={{ marginTop: 12 }}>
          <Button size="sm" variant="outline" onClick={() => window.open(meetingUrl, "_blank")}>
            <ExternalLink size={13} /> Open meeting link
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
