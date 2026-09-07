"use client";

import "@/components/meetings/kimi-ui/meeting-detail/reference.css";
import { MeetingDetailClient } from "@/components/meetings/kimi-ui/meeting-detail/components/MeetingDetailClient";

export function MeetingDetailConnected({ meetingId }: { meetingId: string }) {
  return <MeetingDetailClient meetingId={meetingId} />;
}
