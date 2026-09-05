"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { HostPreJoinScreen, type HostJoinPayload } from "@/components/video/host-pre-join-screen";
import { MeetingRoom } from "@/components/video/meeting-room";

type LoadedMeeting = {
  token: string;
  businessName: string;
  title: string | null;
  scheduledStartAt: string | null;
  recordingNotice: string | null;
  hostDisplayName: string;
  videoMeetingId?: string | null;
};

export function StaffVideoMeetingClient({
  appointmentId,
  hostDisplayName,
}: {
  appointmentId: string;
  hostDisplayName?: string;
}) {
  const [meeting, setMeeting] = useState<LoadedMeeting | null>(null);
  const [error, setError] = useState("");
  const [joinPayload, setJoinPayload] = useState<HostJoinPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const videoRes = await fetch(`/api/appointments/${appointmentId}/video`);
        const videoJson = await videoRes.json();
        const row = videoJson.data?.meeting;
        if (!row?.publicMeetingToken) {
          if (active) setError("No Transovo Video room is linked to this appointment.");
          return;
        }

        const publicRes = await fetch(`/api/video/public/${row.publicMeetingToken}`);
        const publicJson = await publicRes.json();
        if (!publicJson.data) {
          if (active) setError("Unable to load meeting details.");
          return;
        }

        if (!active) return;
        setMeeting({
          token: row.publicMeetingToken,
          businessName: publicJson.data.businessName,
          title: row.title || publicJson.data.title,
          scheduledStartAt: row.scheduledStartAt || publicJson.data.scheduledStartAt,
          recordingNotice: publicJson.data.recordingNotice,
          hostDisplayName: hostDisplayName || "Host",
          videoMeetingId: row.id || null,
        });
      } catch {
        if (active) setError("Unable to load meeting.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [appointmentId, hostDisplayName]);

  async function requestHostJoin(): Promise<HostJoinPayload> {
    const joinRes = await fetch(`/api/appointments/${appointmentId}/video/join`, {
      method: "POST",
    });
    const joinJson = await joinRes.json();
    if (!joinRes.ok) {
      throw new Error(joinJson.error || "Unable to join as host.");
    }
    if (joinJson.data?.waiting) {
      throw new Error("Unexpected waiting-room state for host join.");
    }
    return joinJson.data as HostJoinPayload;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading meeting…</p>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {error || "Meeting not found."}
      </div>
    );
  }

  if (!joinPayload) {
    return (
      <HostPreJoinScreen
        info={{
          title: meeting.title,
          scheduledStartAt: meeting.scheduledStartAt,
          businessName: meeting.businessName,
          hostDisplayName: meeting.hostDisplayName,
          recordingNotice: meeting.recordingNotice,
        }}
        onJoined={setJoinPayload}
        onJoinRequest={requestHostJoin}
      />
    );
  }

  return (
    <MeetingRoom
      token={meeting.token}
      join={joinPayload as never}
      businessName={meeting.businessName}
      showInviteLink
      videoMeetingId={meeting.videoMeetingId || undefined}
      meetingTitle={meeting.title}
      scheduledStartAt={meeting.scheduledStartAt}
    />
  );
}
