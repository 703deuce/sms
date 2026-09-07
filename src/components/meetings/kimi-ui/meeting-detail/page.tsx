"use client";

import { AppShell } from "./components/AppShell";
import { MeetingDetailClient } from "./components/MeetingDetailClient";
import "./reference.css";

export default function ReferencePage() {
  return (
    <AppShell>
      <MeetingDetailClient meetingId="mtg_9f27c1" />
    </AppShell>
  );
}
