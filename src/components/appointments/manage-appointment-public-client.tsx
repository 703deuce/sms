"use client";

import { useEffect, useMemo, useState } from "react";

type IntakeField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

type IntakeForm = {
  id: string;
  name: string;
  fields: IntakeField[];
  answers: Record<string, unknown>;
};

type ManageData = {
  serviceName?: string;
  startsAt?: string;
  status?: string;
  timezone?: string;
  meetingLink?: string | null;
  locationLabel?: string | null;
  recurringSeriesId?: string | null;
  workspaceSlug?: string | null;
  permissions?: {
    cancel?: boolean;
    reschedule?: boolean;
    payBalance?: boolean;
    editIntake?: boolean;
  };
  payment?: {
    paymentStatus?: string;
    balanceDueCents?: number;
    totalPriceCents?: number;
    amountPaidCents?: number;
    paymentRequired?: boolean;
  };
  intakeForms?: IntakeForm[];
  contactId?: string | null;
  resources?: Array<{ id: string; name: string }>;
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatWhen(value?: string, timezone?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    timeZone: timezone || undefined,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ManageAppointmentPage({ token }: { token: string }) {
  const [data, setData] = useState<ManageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [recurringScope, setRecurringScope] = useState<"this" | "future" | "all">("this");
  const [intakeDrafts, setIntakeDrafts] = useState<Record<string, Record<string, string>>>({});

  async function reload() {
    const res = await fetch(`/api/public/manage/${token}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Invalid link");
    setData(json.data);
    const drafts: Record<string, Record<string, string>> = {};
    for (const form of json.data.intakeForms || []) {
      const answers: Record<string, string> = {};
      for (const [key, value] of Object.entries(form.answers || {})) {
        answers[key] = String(value ?? "");
      }
      drafts[form.id] = answers;
    }
    setIntakeDrafts(drafts);
  }

  useEffect(() => {
    void reload().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/manage/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      if (json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
        return;
      }
      if (json.data?.intakeForms) {
        setData((prev) => (prev ? { ...prev, intakeForms: json.data.intakeForms } : prev));
        setMessage("Intake form saved.");
      } else if (json.data) {
        setData((prev) => ({ ...prev, ...json.data }));
        if (body.action === "cancel") setMessage("Appointment canceled.");
        if (body.action === "reschedule") {
          setMessage("Appointment rescheduled.");
          setShowReschedule(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const minReschedule = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  if (error && !data) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">Manage appointment</h1>
        <p className="mt-4 text-sm text-destructive">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <p className="text-sm text-muted-foreground">Loading appointment…</p>
      </main>
    );
  }

  const balanceDue = data.payment?.balanceDueCents || 0;
  const canPay = data.permissions?.payBalance && balanceDue > 0;
  const isRecurring = Boolean(data.recurringSeriesId);

  function downloadIcs() {
    if (!data?.startsAt || !data?.serviceName) return;
    const start = new Date(data.startsAt);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const serviceName = data.serviceName;
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${serviceName}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "appointment.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Manage appointment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View, reschedule, pay, or cancel without signing in.
        </p>
      </header>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Service</dt>
            <dd className="text-right font-medium">{data.serviceName || "Appointment"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">When</dt>
            <dd className="text-right">{formatWhen(data.startsAt, data.timezone)}</dd>
          </div>
          {data.locationLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="text-right">{data.locationLabel}</dd>
            </div>
          ) : null}
          {data.resources && data.resources.length > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Resources</dt>
              <dd className="text-right">{data.resources.map((r) => r.name).join(", ")}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-right capitalize">{data.status || "—"}</dd>
          </div>
          {data.payment?.totalPriceCents ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Payment</dt>
              <dd className="text-right">
                {formatMoney(data.payment.amountPaidCents || 0)} paid
                {balanceDue > 0 ? ` · ${formatMoney(balanceDue)} due` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
        {data.meetingLink ? (
          <a href={data.meetingLink} className="mt-3 inline-block text-sm font-medium text-primary underline">
            Join video meeting
          </a>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="text-sm font-medium text-primary underline" onClick={downloadIcs}>
            Add to calendar
          </button>
          {data.workspaceSlug ? (
            <a href={`/book/${data.workspaceSlug}`} className="text-sm font-medium text-primary underline">
              Book again
            </a>
          ) : null}
        </div>
      </section>

      {canPay ? (
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Outstanding balance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMoney(balanceDue)} is due for this appointment.
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => void act({ action: "pay_balance" })}
          >
            Pay balance
          </button>
        </section>
      ) : null}

      {data.permissions?.editIntake && (data.intakeForms || []).length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold">Intake forms</h2>
          {(data.intakeForms || []).map((form) => (
            <div key={form.id} className="rounded-lg border p-4">
              <p className="text-sm font-medium">{form.name}</p>
              <div className="mt-3 space-y-3">
                {form.fields.map((field) => (
                  <div key={field.id}>
                    <label htmlFor={`${form.id}-${field.id}`} className="text-xs font-medium text-muted-foreground">
                      {field.label}
                      {field.required ? " *" : ""}
                    </label>
                    {field.type === "select" && field.options?.length ? (
                      <select
                        id={`${form.id}-${field.id}`}
                        className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                        value={intakeDrafts[form.id]?.[field.id] || ""}
                        onChange={(e) =>
                          setIntakeDrafts((prev) => ({
                            ...prev,
                            [form.id]: { ...prev[form.id], [field.id]: e.target.value },
                          }))
                        }
                      >
                        <option value="">Select…</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        id={`${form.id}-${field.id}`}
                        rows={3}
                        className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                        value={intakeDrafts[form.id]?.[field.id] || ""}
                        onChange={(e) =>
                          setIntakeDrafts((prev) => ({
                            ...prev,
                            [form.id]: { ...prev[form.id], [field.id]: e.target.value },
                          }))
                        }
                      />
                    ) : field.type === "file" || field.type === "image" ? (
                      <div className="mt-1 space-y-2">
                        <input
                          id={`${form.id}-${field.id}`}
                          type="file"
                          accept={field.type === "image" ? "image/*" : undefined}
                          className="block w-full text-sm"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void (async () => {
                              const formData = new FormData();
                              formData.append("file", file);
                              const res = await fetch(`/api/public/manage/${token}/intake-upload`, {
                                method: "POST",
                                body: formData,
                              });
                              const json = await res.json();
                              if (res.ok && json.data?.url) {
                                setIntakeDrafts((prev) => ({
                                  ...prev,
                                  [form.id]: { ...prev[form.id], [field.id]: String(json.data.url) },
                                }));
                              }
                            })();
                          }}
                        />
                        {intakeDrafts[form.id]?.[field.id] ? (
                          <p className="text-xs text-muted-foreground break-all">
                            {intakeDrafts[form.id][field.id]}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <input
                        id={`${form.id}-${field.id}`}
                        type={field.type === "email" ? "email" : field.type === "number" ? "number" : "text"}
                        className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                        value={intakeDrafts[form.id]?.[field.id] || ""}
                        onChange={(e) =>
                          setIntakeDrafts((prev) => ({
                            ...prev,
                            [form.id]: { ...prev[form.id], [field.id]: e.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                className="mt-3 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                onClick={() =>
                  void act({
                    action: "save_intake",
                    formId: form.id,
                    answers: intakeDrafts[form.id] || {},
                    contactId: data.contactId,
                  })
                }
              >
                Save intake
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {data.permissions?.reschedule ? (
          <button
            type="button"
            disabled={busy || data.status === "canceled"}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() => setShowReschedule((v) => !v)}
          >
            Reschedule
          </button>
        ) : null}
        {data.permissions?.cancel ? (
          <button
            type="button"
            disabled={busy || data.status === "canceled"}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
            onClick={() => {
              const msg = isRecurring
                ? "Cancel this appointment? Choose whether to cancel this visit only, this and future visits, or the entire series."
                : "Cancel this appointment?";
              if (!window.confirm(msg)) return;
              void act({
                action: "cancel",
                recurringScope: isRecurring ? recurringScope : undefined,
              });
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {isRecurring && data.permissions?.cancel ? (
        <fieldset className="rounded-lg border p-4 text-sm">
          <legend className="px-1 font-medium">Recurring series</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {[
              { id: "this", label: "This visit only" },
              { id: "future", label: "This and future" },
              { id: "all", label: "Entire series" },
            ].map((opt) => (
              <label key={opt.id} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="recurring-scope"
                  checked={recurringScope === opt.id}
                  onChange={() => setRecurringScope(opt.id as "this" | "future" | "all")}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {showReschedule ? (
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Pick a new time</h2>
          {isRecurring ? (
            <fieldset className="mt-3 text-sm">
              <legend className="font-medium">Apply reschedule to</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {[
                  { id: "this", label: "This visit only" },
                  { id: "future", label: "This and future" },
                  { id: "all", label: "Entire series" },
                ].map((opt) => (
                  <label key={opt.id} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="reschedule-scope"
                      checked={recurringScope === opt.id}
                      onChange={() => setRecurringScope(opt.id as "this" | "future" | "all")}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <label htmlFor="reschedule-at" className="mt-2 block text-xs text-muted-foreground">
            New date and time
          </label>
          <input
            id="reschedule-at"
            type="datetime-local"
            min={minReschedule}
            value={rescheduleAt}
            onChange={(e) => setRescheduleAt(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || !rescheduleAt}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            onClick={() =>
              void act({
                action: "reschedule",
                startsAt: new Date(rescheduleAt).toISOString(),
                recurringScope: isRecurring ? recurringScope : undefined,
              })
            }
          >
            Confirm reschedule
          </button>
        </section>
      ) : null}
    </main>
  );
}
