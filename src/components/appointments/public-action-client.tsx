"use client";

import { formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";

type ActionKind = "confirm" | "cancel" | "reschedule";

type AppointmentPreview = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  status: string;
  timezone?: string | null;
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error && !appt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-md rounded-xl p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md rounded-xl border-slate-200 p-6">
        {done ? (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-slate-900">{copy.done}</h1>
            {appt ? (
              <p className="mt-2 text-sm text-slate-600">
                {appt.serviceName || "Appointment"} ·{" "}
                {formatAppointmentWhen(appt.startsAt, appt.timezone)}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">{copy.heading}</h1>
            {appt ? (
              <p className="mt-2 text-sm text-slate-600">
                {appt.serviceName || "Appointment"} ·{" "}
                {formatAppointmentWhen(appt.startsAt, appt.timezone)}
              </p>
            ) : null}

            {kind === "reschedule" ? (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {slots.length === 0 ? (
                  <p className="text-sm text-amber-700">No open times available.</p>
                ) : (
                  slots.slice(0, 40).map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedSlot === slot.startsAt
                          ? "border-sky-500 bg-sky-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
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
                  ))
                )}
              </div>
            ) : null}

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

            <Button
              className="mt-6 w-full"
              variant={kind === "cancel" ? "outline" : "default"}
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
