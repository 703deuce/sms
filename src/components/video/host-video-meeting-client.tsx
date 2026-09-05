"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MeetingRoom } from "@/components/video/meeting-room";

export function HostVideoMeetingClient({ videoMeetingId }: { videoMeetingId: string }) {
  const [info, setInfo] = useState<{ token: string; businessName: string } | null>(null);
  const [error, setError] = useState("");
  const [joinPayload, setJoinPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const videoRes = await fetch(`/api/video/meetings/${videoMeetingId}`);
        const videoJson = await videoRes.json();
        const meeting = videoJson.data?.meeting;
        if (!meeting?.publicMeetingToken) {
          if (active) setError("This video meeting could not be found.");
          return;
        }

        const joinRes = await fetch(`/api/video/meetings/${videoMeetingId}/join`, {
          method: "POST",
        });
        const joinJson = await joinRes.json();
        if (!joinRes.ok) {
          if (active) setError(joinJson.error || "Unable to join as host.");
          return;
        }
        if (joinJson.data?.waiting) {
          if (active) setError("Unexpected waiting-room state for host join.");
          return;
        }

        const publicRes = await fetch(`/api/video/public/${meeting.publicMeetingToken}`);
        const publicJson = await publicRes.json();
        if (!publicJson.data) {
          if (active) setError("Unable to load meeting details.");
          return;
        }

        if (!active) return;
        setInfo({ token: meeting.publicMeetingToken, businessName: publicJson.data.businessName });
        setJoinPayload(joinJson.data);
      } catch {
        if (active) setError("Unable to start host join.");
      }
    })();
    return () => {
      active = false;
    };
  }, [videoMeetingId]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!info || !joinPayload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Joining as host…</p>
      </div>
    );
  }

  return (
    <MeetingRoom
      token={info.token}
      join={joinPayload as never}
      businessName={info.businessName}
      showInviteLink
    />
  );
}
