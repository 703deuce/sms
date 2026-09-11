import { Suspense } from "react";
import { MeetingsClient } from "@/components/appointments/meetings-client";

export default function AppointmentsMeetingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading meetings…</div>}>
      <MeetingsClient />
    </Suspense>
  );
}
