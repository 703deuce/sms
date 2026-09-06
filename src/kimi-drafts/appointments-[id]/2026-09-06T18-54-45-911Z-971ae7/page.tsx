"use client";

import "./reference.css";
import { AppShell } from "./components/AppShell";
import { AppointmentDetail } from "./components/AppointmentDetail";

export default function ReferencePage() {
  return (
    <AppShell>
      <AppointmentDetail appointmentId="appt_9f2k" />
    </AppShell>
  );
}
