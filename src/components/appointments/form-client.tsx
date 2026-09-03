"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type AppointmentType = { id: string; name: string; durationMinutes: number };
type Slot = { startsAt: string; endsAt: string };

export function AppointmentFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledStart = searchParams.get("startsAt") || "";
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [smsConsent, setSmsConsent] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedType = types.find((t) => t.id === serviceId);

  useEffect(() => {
    if (prefilledStart) setStartsAt(prefilledStart);
  }, [prefilledStart]);

  useEffect(() => {
    fetch("/api/appointments/types")
      .then((r) => r.json())
      .then((json) => {
        const list = json.data || [];
        setTypes(list);
        if (list[0]?.id) setServiceId(list[0].id);
      });
  }, []);

  useEffect(() => {
    if (!selectedType) return;
    setLoadingSlots(true);
    fetch(
      `/api/appointments/availability?serviceName=${encodeURIComponent(selectedType.name)}&daysAhead=14`,
    )
      .then((r) => r.json())
      .then((json) => setSlots(json.data?.slots || []))
      .finally(() => setLoadingSlots(false));
  }, [selectedType?.id, selectedType?.name]);

  async function submit() {
    if (!selectedType || !startsAt || !phone.trim()) {
      setError("Service, time slot, and phone are required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: selectedType.id,
        serviceName: selectedType.name,
        startsAt,
        firstName,
        lastName,
        phone,
        email,
        notes,
        smsConsent,
        status: "scheduled",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not create appointment");
      setSaving(false);
      return;
    }
    router.push(`/appointments/${json.data.appointmentId}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">New Appointment</h1>
        <p className="mt-1 text-sm text-slate-500">Book a customer manually from the admin calendar.</p>
      </div>

      <Card className="max-w-2xl rounded-xl border-slate-200 p-4">
        <div className="space-y-4">
          <div>
            <Label htmlFor="service">Appointment type</Label>
            <select
              id="service"
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                setStartsAt("");
              }}
            >
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.durationMinutes} min)
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Available times</Label>
            {loadingSlots ? (
              <p className="mt-2 text-sm text-muted-foreground">Loading availability…</p>
            ) : slots.length === 0 ? (
              <p className="mt-2 text-sm text-amber-700">
                No open slots found. Connect a calendar or adjust appointment type settings.
              </p>
            ) : (
              <div className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {slots.map((slot) => {
                  const label = new Date(slot.startsAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const selected = startsAt === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      className={`rounded-md border px-2 py-2 text-left text-xs ${
                        selected ? "border-sky-500 bg-sky-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                      onClick={() => setStartsAt(slot.startsAt)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="first">First name</Label>
              <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="last">Last name</Label>
              <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} />
            Send booking confirmation SMS (requires consent)
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={saving || !startsAt}>
              {saving ? "Booking…" : "Create appointment"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/appointments")}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
