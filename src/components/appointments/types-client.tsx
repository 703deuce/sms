"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import Link from "next/link";
import { useEffect, useState } from "react";

type AppointmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  calendarId: string | null;
  active: boolean;
  config: {
    description?: string;
    location?: string;
    priceDisplay?: string;
    bookingHours?: string;
    minimumBookingNoticeMinutes?: number;
    maximumBookingDaysAhead?: number;
    enabled?: boolean;
    bookingQuestions?: Array<{ id: string; label: string; type: string; required?: boolean }>;
  };
};

const emptyForm = {
  name: "",
  durationMinutes: 30,
  bufferMinutes: 0,
  description: "",
  location: "",
  priceDisplay: "",
  bookingHours: "Mon-Fri 09:00-17:00",
  minimumBookingNoticeMinutes: 60,
  maximumBookingDaysAhead: 14,
  enabled: true,
  customQuestion: "",
  customQuestionRequired: false,
};

export function AppointmentTypesClient() {
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/appointments/types");
    const json = await res.json();
    setTypes(json.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        setWorkspaceSlug(json.workspace?.slug || "");
        setBookingEnabled(Boolean(json.data?.bookingEnabled));
      });
  }, []);

  async function save() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(editingId ? `/api/appointments/types/${editingId}` : "/api/appointments/types", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        durationMinutes: form.durationMinutes,
        bufferMinutes: form.bufferMinutes,
        config: {
          description: form.description,
          location: form.location,
          priceDisplay: form.priceDisplay,
          bookingHours: form.bookingHours,
          minimumBookingNoticeMinutes: form.minimumBookingNoticeMinutes,
          maximumBookingDaysAhead: form.maximumBookingDaysAhead,
          enabled: form.enabled,
          bookingQuestions: form.customQuestion.trim()
            ? [
                {
                  id: "custom_question",
                  label: form.customQuestion.trim(),
                  type: "text",
                  required: form.customQuestionRequired,
                },
              ]
            : [],
        },
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save appointment type");
      setSaving(false);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
    await load();
  }

  function startEdit(type: AppointmentType) {
    setEditingId(type.id);
    setForm({
      name: type.name,
      durationMinutes: type.durationMinutes,
      bufferMinutes: type.bufferMinutes,
      description: type.config.description || "",
      location: type.config.location || "",
      priceDisplay: type.config.priceDisplay || "",
      bookingHours: type.config.bookingHours || "Mon-Fri 09:00-17:00",
      minimumBookingNoticeMinutes: type.config.minimumBookingNoticeMinutes || 60,
      maximumBookingDaysAhead: type.config.maximumBookingDaysAhead || 14,
      enabled: type.config.enabled !== false,
      customQuestion: type.config.bookingQuestions?.[0]?.label || "",
      customQuestionRequired: Boolean(type.config.bookingQuestions?.[0]?.required),
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Appointment Types</h1>
        <p className="mt-1 text-sm text-slate-500">
          Define services customers can book — duration, location, and availability rules.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-xl border-slate-200 p-4">
          <h2 className="mb-4 font-semibold text-slate-900">
            {editingId ? "Edit appointment type" : "New appointment type"}
          </h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="buffer">Buffer (minutes)</Label>
                <Input
                  id="buffer"
                  type="number"
                  value={form.bufferMinutes}
                  onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="price">Price display (optional)</Label>
              <Input
                id="price"
                placeholder="$49"
                value={form.priceDisplay}
                onChange={(e) => setForm({ ...form, priceDisplay: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="hours">Availability hours</Label>
              <Input
                id="hours"
                placeholder="Mon-Fri 09:00-17:00"
                value={form.bookingHours}
                onChange={(e) => setForm({ ...form, bookingHours: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="notice">Min notice (minutes)</Label>
                <Input
                  id="notice"
                  type="number"
                  value={form.minimumBookingNoticeMinutes}
                  onChange={(e) =>
                    setForm({ ...form, minimumBookingNoticeMinutes: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor="horizon">Max days ahead</Label>
                <Input
                  id="horizon"
                  type="number"
                  value={form.maximumBookingDaysAhead}
                  onChange={(e) =>
                    setForm({ ...form, maximumBookingDaysAhead: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              Active on booking page
            </label>
            <div>
              <Label htmlFor="custom-q">Custom booking question (optional)</Label>
              <Input
                id="custom-q"
                placeholder="e.g. What brings you in today?"
                value={form.customQuestion}
                onChange={(e) => setForm({ ...form, customQuestion: e.target.value })}
              />
            </div>
            {form.customQuestion.trim() ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.customQuestionRequired}
                  onChange={(e) => setForm({ ...form, customQuestionRequired: e.target.checked })}
                />
                Require answer on booking form
              </label>
            ) : null}
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update type" : "Create type"}
              </Button>
              {editingId ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading types…</p>
          ) : types.length === 0 ? (
            <Card className="rounded-xl border-dashed p-6 text-sm text-slate-500">
              No appointment types yet. Create one to enable booking.
            </Card>
          ) : (
            types.map((type) => {
              const typePath = workspaceSlug
                ? `/book/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(type.id)}`
                : "";
              const typeUrl =
                typeof window !== "undefined" && typePath
                  ? `${window.location.origin}${typePath}`
                  : typePath;
              return (
              <Card key={type.id} className="rounded-xl border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {type.name}
                      {!type.active ? (
                        <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Inactive
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {type.durationMinutes} min
                      {type.bufferMinutes ? ` · ${type.bufferMinutes} min buffer` : ""}
                      {type.config.location ? ` · ${type.config.location}` : ""}
                    </p>
                    {type.config.description ? (
                      <p className="mt-2 text-sm text-slate-600">{type.config.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      Booking page: {bookingEnabled && typePath ? "Enabled" : "Disabled or not configured"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(type)}>
                      Edit
                    </Button>
                    {typePath && bookingEnabled ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigator.clipboard.writeText(typeUrl)}
                        >
                          Copy link
                        </Button>
                        <Link href={typePath} target="_blank" className="text-center text-xs text-sky-700 hover:underline">
                          Preview
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
            })
          )}
          <p className="text-xs text-slate-500">
            Set weekly availability on{" "}
            <Link href="/appointments/availability" className="text-sky-700 hover:underline">
              Availability
            </Link>
            . Inactive types cannot be booked publicly.
          </p>
        </div>
      </div>
    </div>
  );
}
