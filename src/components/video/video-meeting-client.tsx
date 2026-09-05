"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PreJoinScreen, type PreJoinMeetingInfo } from "@/components/video/pre-join-screen";
import { MeetingRoom } from "@/components/video/meeting-room";

export function VideoMeetingClient({ token }: { token: string }) {
  const [info, setInfo] = useState<PreJoinMeetingInfo | null>(null);
  const [error, setError] = useState("");
  const [joinPayload, setJoinPayload] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`/api/video/public/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) {
          setError("This meeting link is invalid or has expired.");
          return;
        }
        setInfo({ ...json.data, token });
      })
      .catch(() => setError("Unable to load meeting."));
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (joinPayload) {
    return (
      <MeetingRoom
        token={token}
        join={joinPayload as never}
        businessName={info.businessName}
      />
    );
  }

  return <PreJoinScreen info={info} onJoined={(payload) => setJoinPayload(payload)} />;
}
