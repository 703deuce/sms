"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { VIDEO_STATUS_LABELS } from "@/lib/transovo-video/types";
import { Copy, Video } from "lucide-react";
import Link from "next/link";

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

export function VideoMeetingPanel({ appointmentId }: { appointmentId: string }) {
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

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading video meeting…</p>;
  }

  if (!entitled) {
    return null;
  }

  if (!meeting) {
    return (
      <Card className="p-4">
        <CardTitle className="text-base">Transovo Video</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          No Transovo Video room is linked to this appointment.
        </p>
      </Card>
    );
  }

  const meetingUrl = meeting.meetingUrl || `/video/${meeting.publicMeetingToken}`;
  const hostJoinUrl = `/appointments/${appointmentId}/video/host`;

  async function copyGuestLink() {
    await navigator.clipboard.writeText(meetingUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" />
            Transovo Video
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {VIDEO_STATUS_LABELS[meeting.status as keyof typeof VIDEO_STATUS_LABELS] || meeting.status}
            {" · "}
            Up to {meeting.maxParticipants} participants
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your meeting
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={hostJoinUrl}>
              <Video className="mr-2 h-4 w-4" />
              Join as host
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={meetingUrl} target="_blank" rel="noreferrer">
              Preview guest join
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void copyGuestLink()}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Copied" : "Copy guest link"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Customers receive this join link automatically in confirmation and reminder messages.
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <p>Recording: <span className="font-medium capitalize">{meeting.recordingMode}</span></p>
        <p>AI recap: <span className="font-medium">{meeting.aiRecapEnabled ? "On" : "Off"}</span></p>
      </div>
    </Card>
  );
}
