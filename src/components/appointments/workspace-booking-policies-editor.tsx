"use client";

import { useEffect, useState } from "react";

export type WorkspaceBookingPolicyForm = {
  cancellationPolicyText: string;
  noShowPolicyText: string;
  lateCancelHours: number;
  lateCancelFeeCents: number;
};

type Props = {
  variant?: "card" | "page";
  title?: string;
  description?: string;
  showTypeOverrideNote?: boolean;
};

function parsePolicyPayload(data: Record<string, unknown>): WorkspaceBookingPolicyForm {
  const ext = (data.extendedCancellation || {}) as Record<string, unknown>;
  return {
    cancellationPolicyText: String(data.cancellationPolicyText || ext.policyText || ""),
    noShowPolicyText: String(data.noShowPolicyText || ext.noShowPolicyText || ""),
    lateCancelHours: Number(ext.lateCancelHours ?? data.lateCancelHours ?? 24),
    lateCancelFeeCents: Number(ext.lateCancelFeeCents ?? ext.lateFeeCents ?? 0),
  };
}

function buildPolicyPatch(form: WorkspaceBookingPolicyForm) {
  return {
    cancellationPolicyText: form.cancellationPolicyText,
    noShowPolicyText: form.noShowPolicyText,
    lateCancelHours: form.lateCancelHours,
    extendedCancellation: {
      policyText: form.cancellationPolicyText,
      noShowPolicyText: form.noShowPolicyText,
      lateCancelHours: form.lateCancelHours,
      lateFeeCents: form.lateCancelFeeCents,
    },
  };
}

export function WorkspaceBookingPoliciesEditor({
  variant = "page",
  title = "Default booking policies",
  description = "Workspace-wide defaults used when a booking type does not define its own policy text.",
  showTypeOverrideNote = true,
}: Props) {
  const [form, setForm] = useState<WorkspaceBookingPolicyForm>({
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
        const data = (json.data || {}) as Record<string, unknown>;
        setForm(parsePolicyPayload(data));
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPolicyPatch(form)),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setMessage(json.error || "Could not save policies");
      return;
    }
    setMessage("Policies saved");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading booking policies…</p>;
  }

  const shellClass =
    variant === "card"
      ? "space-y-4 rounded-lg border border-border bg-card p-5"
      : "space-y-6";

  return (
    <div className={shellClass}>
      <header>
        <h2 className={variant === "card" ? "text-base font-semibold text-foreground" : "text-2xl font-semibold text-foreground"}>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {showTypeOverrideNote ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Booking types with their own policy text in{" "}
            <span className="font-medium">Booking Types → Policies</span> override these defaults at runtime.
          </p>
        ) : null}
      </header>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Cancellation policy</label>
          <textarea
            className="w-full min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.cancellationPolicyText}
            onChange={(e) => setForm((f) => ({ ...f, cancellationPolicyText: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">No-show policy</label>
          <textarea
            className="w-full min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.noShowPolicyText}
            onChange={(e) => setForm((f) => ({ ...f, noShowPolicyText: e.target.value }))}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Late cancellation window (hours)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.lateCancelHours}
              onChange={(e) => setForm((f) => ({ ...f, lateCancelHours: Number(e.target.value) || 0 }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Late cancel fee (cents)</span>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save policies"}
          </button>
          {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
        </div>
      </div>
    </div>
  );
}
