"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  Check,
  Clock,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  X,
} from "lucide-react";
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

function StatusChip({ tone, children }: { tone: "active" | "inactive"; children: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "active"
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15"
          : "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "active" ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {children}
    </span>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-muted/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
      />
      <span>
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </label>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border/70 pt-4 first:border-t-0 first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

export function AppointmentTypesClient() {
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function copyLink(id: string) {
    if (!workspaceSlug || typeof window === "undefined") return;
    const url = `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Appointment Types
          </h1>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            Reusable services customers can book — set duration, location, and availability rules once, then share the booking link.
          </p>
        </div>
        {types.length > 0 ? (
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {types.length} type{types.length === 1 ? "" : "s"} ·{" "}
            {types.filter((t) => t.active && t.config.enabled !== false).length} active
          </span>
        ) : null}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ——— Form ——— */}
        <Card className="p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
                {editingId ? "Edit appointment type" : "New appointment type"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {editingId
                  ? "Changes apply to the public booking page immediately."
                  : "Fill in the basics — you can refine it later."}
              </p>
            </div>
            {editingId ? (
              <Button variant="ghost" size="icon" onClick={resetForm} aria-label="Cancel editing">
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          <div className="space-y-5">
            <FormSection title="Basics">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. 30-minute consultation"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={0}
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="buffer">Buffer (min)</Label>
                  <Input
                    id="buffer"
                    type="number"
                    min={0}
                    value={form.bufferMinutes}
                    onChange={(e) => setForm({ ...form, bufferMinutes: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="Office, phone, video…"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price (optional)</Label>
                  <Input
                    id="price"
                    placeholder="$49"
                    value={form.priceDisplay}
                    onChange={(e) => setForm({ ...form, priceDisplay: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="What customers should know before booking…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </FormSection>

            <FormSection title="Availability rules">
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
                  <Label htmlFor="notice">Min notice (min)</Label>
                  <Input
                    id="notice"
                    type="number"
                    min={0}
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
                    min={1}
                    value={form.maximumBookingDaysAhead}
                    onChange={(e) =>
                      setForm({ ...form, maximumBookingDaysAhead: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <CheckboxRow
                checked={form.enabled}
                onChange={(v) => setForm({ ...form, enabled: v })}
                label="Active on booking page"
                hint="Inactive types stay saved but can't be booked publicly."
              />
            </FormSection>

            <FormSection title="Booking form">
              <div>
                <Label htmlFor="custom-q">Custom question (optional)</Label>
                <Input
                  id="custom-q"
                  placeholder="e.g. What brings you in today?"
                  value={form.customQuestion}
                  onChange={(e) => setForm({ ...form, customQuestion: e.target.value })}
                />
              </div>
              {form.customQuestion.trim() ? (
                <CheckboxRow
                  checked={form.customQuestionRequired}
                  onChange={(v) => setForm({ ...form, customQuestionRequired: v })}
                  label="Require an answer on the booking form"
                />
              ) : null}
            </FormSection>

            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15">
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-2 border-t border-border/70 pt-4">
              <Button onClick={save} disabled={saving} className="min-w-28">
                {saving ? "Saving…" : editingId ? "Update type" : "Create type"}
              </Button>
              {editingId ? (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </Card>

        {/* ——— List ——— */}
        <div className="space-y-3">
          {loading ? (
            <Card className="p-5">
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="animate-pulse rounded-lg bg-muted/60 p-4">
                    <div className="h-4 w-1/3 rounded bg-border" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-border/70" />
                  </div>
                ))}
              </div>
            </Card>
          ) : types.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
              <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="h-5 w-5" />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">
                No appointment types yet
              </h3>
              <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                Create your first service on the left — customers will be able to book it from your public booking page.
              </p>
            </div>
          ) : (
            <>
              {types.map((type) => {
                const typePath = workspaceSlug
                  ? `/book/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(type.id)}`
                  : "";
                const isLive = Boolean(bookingEnabled && typePath && type.active && type.config.enabled !== false);
                const isEditing = editingId === type.id;
                return (
                  <Card
                    key={type.id}
                    className={cn(
                      "p-4 transition-all duration-150",
                      isEditing && "border-primary/40 ring-2 ring-ring/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-display text-sm font-semibold text-foreground">
                            {type.name}
                          </p>
                          <StatusChip tone={isLive ? "active" : "inactive"}>
                            {isLive ? "Live" : "Inactive"}
                          </StatusChip>
                          {type.config.priceDisplay ? (
                            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                              {type.config.priceDisplay}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {type.durationMinutes} min
                            {type.bufferMinutes ? ` (+${type.bufferMinutes} buffer)` : ""}
                          </span>
                          {type.config.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {type.config.location}
                            </span>
                          ) : null}
                          {type.config.bookingHours ? (
                            <span className="tabular-nums">{type.config.bookingHours}</span>
                          ) : null}
                        </div>
                        {type.config.description ? (
                          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                            {type.config.description}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                      <Button variant="outline" size="sm" onClick={() => startEdit(type)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {typePath ? (
                        <>
                          <Link href={typePath} target="_blank">
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Preview
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => copyLink(type.id)}>
                            {copiedId === type.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy link
                              </>
                            )}
                          </Button>
                        </>
                      ) : null}
                      {!bookingEnabled || !typePath ? (
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          Booking page not enabled
                        </span>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
              <p className="px-1 pt-1 text-xs leading-relaxed text-muted-foreground">
                Set weekly availability on{" "}
                <Link
                  href="/appointments/availability"
                  className="font-medium text-primary hover:underline"
                >
                  Availability
                </Link>
                . Inactive types cannot be booked publicly.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
