"use client";

import { useEffect, useState } from "react";
import { Check, Link2Off } from "lucide-react";
import {
  OpusPublicBookingError,
  OpusPublicBookingLoading,
} from "@/newui-transplant/components/public-booking/opus-public-booking-states";
import { Button } from "@/newui-transplant/components/ui/button";
import { PublicCustomerAppointmentShell } from "@/newui-transplant/connected/appointments/public-customer-appointment-shell";
import { PublicDayTimeSlotPicker } from "@/newui-transplant/components/public-booking/public-day-time-slot-picker";

type Slot = { startsAt: string; endsAt: string };
type Appt = {
  serviceName: string | null;
  startsAt: string;
  timezone?: string | null;
  selfServiceBlocked?: boolean;
};

function formatSlot(startsAt: string, timezone?: string | null): string {
  const d = new Date(startsAt);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });
}

export function PublicRescheduleOpusPage({ token }: { token: string }) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "invalid">("loading");
  const [appt, setAppt] = useState<Appt | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [requestOnly, setRequestOnly] = useState(false);
  const [durationUnavailable, setDurationUnavailable] = useState(false);
  const [selected, setSelected] = useState("");
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/appointments/reschedule/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalid");
        return r.json();
      })
      .then((json) => {
        setAppt(json.data);
        setRequestOnly(Boolean(json.data.requestOnly));
        setDurationUnavailable(Boolean(json.data.durationUnavailable));
        setSlots(json.data.slots || []);
        setLoadState("ready");
      })
      .catch(() => setLoadState("invalid"));
  }, [token]);

  async function submit() {
    if (!token || acting) return;
    setActing(true);
    setError("");
    const res = await fetch(`/api/public/appointments/reschedule/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: selected }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not reschedule. Try another time.");
      setActing(false);
      return;
    }
    setAppt((prev) => (prev ? { ...prev, startsAt: json.data.startsAt || selected } : prev));
    setDone(true);
    setActing(false);
  }

  if (loadState === "loading") {
    return (
      <PublicCustomerAppointmentShell>
        <OpusPublicBookingLoading />
      </PublicCustomerAppointmentShell>
    );
  }

  if (loadState === "invalid" || !appt) {
    return (
      <PublicCustomerAppointmentShell>
        <div className="flex flex-col items-center text-center">
          <Link2Off className="mb-3 size-10 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">This link is invalid or expired</h1>
        </div>
      </PublicCustomerAppointmentShell>
    );
  }

  if (appt.selfServiceBlocked) {
    return (
      <PublicCustomerAppointmentShell>
        <p className="text-sm text-muted-foreground" role="status">
          This appointment can no longer be rescheduled online. Please contact the business.
        </p>
      </PublicCustomerAppointmentShell>
    );
  }

  if (done) {
    return (
      <PublicCustomerAppointmentShell>
        <div className="flex flex-col items-center text-center">
          <Check className="mb-3 size-10 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold">You&apos;re rescheduled</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatSlot(appt.startsAt, appt.timezone)}
          </p>
        </div>
      </PublicCustomerAppointmentShell>
    );
  }

  if (requestOnly) {
    return (
      <PublicCustomerAppointmentShell>
        <h1 className="text-lg font-semibold">Request a new time</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Online instant rescheduling isn&apos;t available. Use the link in your reminder email or
          contact the business.
        </p>
      </PublicCustomerAppointmentShell>
    );
  }

  if (durationUnavailable) {
    return (
      <PublicCustomerAppointmentShell>
        <OpusPublicBookingError
          message="We couldn't determine this appointment's length. Please contact the business to reschedule."
          onRetry={() => window.location.reload()}
        />
      </PublicCustomerAppointmentShell>
    );
  }

  return (
    <PublicCustomerAppointmentShell>
      <h1 className="text-lg font-semibold">Reschedule your appointment</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Current: {formatSlot(appt.startsAt, appt.timezone)}
      </p>
      <PublicDayTimeSlotPicker
        slots={slots}
        timezone={appt.timezone}
        selectedStartsAt={selected}
        onSelectStartsAt={setSelected}
      />
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={!selected || acting || slots.length === 0}
        onClick={() => void submit()}
      >
        {acting ? "Confirming…" : "Confirm new time"}
      </Button>
    </PublicCustomerAppointmentShell>
  );
}
