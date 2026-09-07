"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/appointments/kimi-ui/appointments-new/reference.css";
import { AppointmentForm } from "@/components/appointments/kimi-ui/appointments-new/components/appointment-form";

export function AppointmentsNewConnected() {
  const router = useRouter();
  const [createdId, setCreatedId] = useState<string | null>(null);

  return (
    <div className="tv-page">
      <AppointmentForm
        createdId={createdId}
        onCreated={(id) => {
          setCreatedId(id);
          if (id) router.push(`/appointments/${id}`);
        }}
        onReset={() => setCreatedId(null)}
      />
    </div>
  );
}
