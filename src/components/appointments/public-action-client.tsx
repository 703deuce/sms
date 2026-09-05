"use client";

import { formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarCheck, Check, Video } from "lucide-react";
import { useEffect, useState } from "react";

type ActionKind = "confirm" | "cancel" | "reschedule";

type AppointmentPreview = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  status: string;
  timezone?: string | null;
  meetingLink?: string | null;
  isTransovoVideo?: boolean;
  locationLabel?: string | null;
};

type Slot = { startsAt: string; endsAt: string };

export function PublicAppointmentActionClient({
  kind,
  token,
}: {
  kind: ActionKind;
  token: string;
}) {
  const [appt, setAppt] = useState<AppointmentPreview | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const apiBase = `/api/public/appointments/${kind}/${encodeURIComponent(token)}`;

  useEffect(() => {
    fetch(apiBase)
      .then(async (r) => {
        if (!r.ok) {
          const json = await r.json().catch(() => ({}));
          throw new Error(json.error || "Invalid link");
        }
        return r.json();
      })
      .then((json) => {
        setAppt(json.data);
        if (kind === "reschedule" && json.data.slots) {
          setSlots(json.data.slots);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiBase, kind]);

  async function submit() {
    setActing(true);
    setError("");
    const body = kind === "reschedule" ? { startsAt: selectedSlot } : undefined;
    const res = await fetch(apiBase, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Something went wrong");
      setActing(false);
      return;
    }
    setDone(true);
    setActing(false);
    if (json.data) setAppt((prev) => (prev ? { ...prev, ...json.data } : prev));
  }

  const titles: Record<ActionKind, { heading: string; done: string; cta: string }> = {
    confirm: {
      heading: "Confirm your appointment",
      done: "Your appointment is confirmed. See you then!",
      cta: "Confirm appointment",
    },
    cancel: {
      heading: "Cancel your appointment",
      done: "Your appointment has been canceled.",
      cta: "Cancel appointment",
    },
    reschedule: {
      heading: "Reschedule your appointment",
      done: "Your appointment has been rescheduled. Check your texts for updated details.",
      cta: "Confirm new time",
    },
  };

  const copy = titles[kind];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Loading…
        </div>
      </div>
    );
  }

  if (error && !appt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </Card>
      </div>
    );
  }

  const showJoinMeeting = Boolean(appt?.meetingLink) && kind !== "cancel" && (!done || kind === "confirm");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
              <Check className="h-6 w-6" />
            </div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {copy.done}
            </h1>
            {appt ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                {appt.serviceName || "Appointment"} ·{" "}
                {formatAppointmentWhen(appt.startsAt, appt.timezone)}
              </p>
            ) : null}
            {showJoinMeeting && appt?.meetingLink ? (
              <Button asChild size="lg" className="mt-6 w-full">
                <a href={appt.meetingLink} target="_blank" rel="noreferrer">
                  <Video className="mr-2 h-4 w-4" />
                  {appt.isTransovoVideo ? "Join meeting" : "Open meeting link"}
                </a>
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {copy.heading}
            </h1>
            {appt ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarCheck className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {appt.serviceName || "Appointment"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {formatAppointmentWhen(appt.startsAt, appt.timezone)}
                  </p>
                  {appt.locationLabel ? (
                    <p className="text-[12px] text-muted-foreground">{appt.locationLabel}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showJoinMeeting && appt?.meetingLink ? (
              <Button asChild size="lg" className="mt-4 w-full" variant="outline">
                <a href={appt.meetingLink} target="_blank" rel="noreferrer">
                  <Video className="mr-2 h-4 w-4" />
                  {appt.isTransovoVideo ? "Join meeting" : "Open meeting link"}
                </a>
              </Button>
            ) : null}

            {kind === "reschedule" ? (
              <div className="mt-5 max-h-64 space-y-2 overflow-y-auto pr-1">
                {slots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                    <p className="text-[13px] font-medium text-amber-800">
                      No open times available.
                    </p>
                  </div>
                ) : (
                  slots.slice(0, 40).map((slot) => {
                    const selected = selectedSlot === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        className={cn(
                          "block w-full rounded-lg border px-3.5 py-2.5 text-left text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected
                            ? "border-primary bg-primary/5 text-foreground shadow-sm"
                            : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40",
                        )}
                        onClick={() => setSelectedSlot(slot.startsAt)}
                      >
                        {new Date(slot.startsAt).toLocaleString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-lg bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-700">
                {error}
              </p>
            ) : null}

            <Button
              size="lg"
              className="mt-6 w-full"
              variant={kind === "cancel" ? "outline" : "primary"}
              disabled={acting || (kind === "reschedule" && !selectedSlot)}
              onClick={submit}
            >
              {acting ? "Working…" : copy.cta}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
