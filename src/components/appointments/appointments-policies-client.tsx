"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PolicyForm = {
  cancellationPolicyText: string;
  noShowPolicyText: string;
  lateCancelHours: number;
  lateCancelFeeCents: number;
};

export function AppointmentsPoliciesClient() {
  const [form, setForm] = useState<PolicyForm>({
    cancellationPolicyText: "",
    noShowPolicyText: "",
    lateCancelHours: 24,
    lateCancelFeeCents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data || {};
        const ext = (data.extendedCancellation || {}) as Record<string, unknown>;
        setForm({
          cancellationPolicyText: String(data.cancellationPolicyText || ext.policyText || ""),
          noShowPolicyText: String(data.noShowPolicyText || ext.noShowPolicyText || ""),
          lateCancelHours: Number(ext.lateCancelHours ?? data.lateCancelHours ?? 24),
          lateCancelFeeCents: Number(ext.lateCancelFeeCents ?? 0),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cancellationPolicyText: form.cancellationPolicyText,
        noShowPolicyText: form.noShowPolicyText,
        lateCancelHours: form.lateCancelHours,
        extendedCancellation: {
          policyText: form.cancellationPolicyText,
          noShowPolicyText: form.noShowPolicyText,
          lateCancelHours: form.lateCancelHours,
          lateFeeCents: form.lateCancelFeeCents,
        },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Could not save policies");
      return;
    }
    setMessage("Policies saved");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading policies…</p>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Booking policies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cancellation policy, no-show policy, and late-cancel rules shown on public booking.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border p-4">
        <div>
          <label className="block text-sm font-medium mb-1">Cancellation policy</label>
          <textarea
            className="w-full min-h-[96px] rounded border px-3 py-2 text-sm"
            value={form.cancellationPolicyText}
            onChange={(e) => setForm((f) => ({ ...f, cancellationPolicyText: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">No-show policy</label>
          <textarea
            className="w-full min-h-[96px] rounded border px-3 py-2 text-sm"
            value={form.noShowPolicyText}
            onChange={(e) => setForm((f) => ({ ...f, noShowPolicyText: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Late cancel window (hours)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.lateCancelHours}
              onChange={(e) => setForm((f) => ({ ...f, lateCancelHours: Number(e.target.value) || 0 }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Late cancel fee (cents)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded border px-3 py-2"
              value={form.lateCancelFeeCents}
              onChange={(e) =>
                setForm((f) => ({ ...f, lateCancelFeeCents: Number(e.target.value) || 0 }))
              }
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save policies"}
          </button>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Per-type overrides live on{" "}
        <Link href="/appointments/services" className="text-primary underline">services</Link>.
      </p>
    </div>
  );
}
