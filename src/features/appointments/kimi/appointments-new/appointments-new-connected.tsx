"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@/components/appointments/kimi-ui/appointments-new/reference.css";
import { AppointmentForm } from "@/components/appointments/kimi-ui/appointments-new/components/appointment-form";

export function AppointmentsNewConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createdId, setCreatedId] = useState<string | null>(null);

  const initialStartsAt = useMemo(() => {
    const raw = searchParams.get("startsAt") || searchParams.get("start");
    if (!raw) return undefined;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }, [searchParams]);

  const initialServiceId = searchParams.get("serviceId") || undefined;
  const initialStaffId = searchParams.get("staffId") || undefined;
  const initialLocationId = searchParams.get("locationId") || undefined;

  return (
    <div className="tv-page">
      <AppointmentForm
        initialStartsAt={initialStartsAt}
        initialServiceId={initialServiceId}
        initialStaffId={initialStaffId}
        initialLocationId={initialLocationId}
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
