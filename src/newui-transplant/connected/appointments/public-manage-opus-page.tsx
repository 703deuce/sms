"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarClock, Link2Off } from "lucide-react";
import { OpusPublicBookingLoading } from "@/newui-transplant/components/public-booking/opus-public-booking-states";
import { Button } from "@/newui-transplant/components/ui/button";
import { PublicCustomerAppointmentShell } from "@/newui-transplant/connected/appointments/public-customer-appointment-shell";

type ManagePayload = {
  serviceName: string | null;
  startsAt: string;
  timezone?: string | null;
  businessName?: string;
  status: string;
  selfServiceBlocked?: boolean;
  selfServiceBlockReason?: string;
  actions?: { reschedule?: string | null; cancel?: string | null };
};

function formatWhen(startsAt: string, timezone?: string | null): string {
  const d = new Date(startsAt);
  return d.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });
}

export function PublicManageOpusPage({ token }: { token: string }) {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "invalid">("loading");
  const [data, setData] = useState<ManagePayload | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoadState("loading");
    fetch(`/api/public/appointments/manage/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalid");
        return r.json();
      })
      .then((json) => {
        setData(json.data as ManagePayload);
        setLoadState("ready");
      })
      .catch(() => setLoadState("invalid"));
  }, [token]);

  if (loadState === "loading") {
    return (
      <PublicCustomerAppointmentShell>
        <OpusPublicBookingLoading />
      </PublicCustomerAppointmentShell>
    );
  }

  if (loadState === "invalid" || !data) {
    return (
      <PublicCustomerAppointmentShell>
        <div className="flex flex-col items-center text-center">
          <Link2Off className="mb-3 size-10 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-semibold">This link is invalid or expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact the business directly if you need to change your appointment.
          </p>
        </div>
      </PublicCustomerAppointmentShell>
    );
  }

  const when = formatWhen(data.startsAt, data.timezone);
  const blocked = data.selfServiceBlocked || /cancel/i.test(data.status);

  return (
    <PublicCustomerAppointmentShell businessName={data.businessName}>
      <h1 className="text-xl font-semibold tracking-tight">
        {data.serviceName || "Appointment"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{when}</p>

      {blocked ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          This appointment can no longer be changed online. Please contact the business if you
          need help.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {data.actions?.reschedule ? (
            <Button asChild className="w-full">
              <Link href={data.actions.reschedule}>
                <CalendarClock className="mr-2 size-4" aria-hidden />
                Reschedule
              </Link>
            </Button>
          ) : null}
          {data.actions?.cancel ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={data.actions.cancel}>Cancel</Link>
            </Button>
          ) : null}
        </div>
      )}
    </PublicCustomerAppointmentShell>
  );
}
