"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney, StatusBadge } from "@/components/appointments/commerce-admin-shared";

type CouponRow = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageCap?: number | null;
  onePerCustomer?: boolean;
  active: boolean;
  eligibleTargets?: Record<string, unknown>;
};

function couponStatus(row: CouponRow) {
  const now = Date.now();
  if (!row.active) return "disabled";
  if (row.startsAt && new Date(row.startsAt).getTime() > now) return "scheduled";
  if (row.expiresAt && new Date(row.expiresAt).getTime() < now) return "expired";
  return "active";
}

function generateCode() {
  return `SAVE${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function DiscountsAdminClient() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    code: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "10",
    startsAt: "",
    expiresAt: "",
    usageCap: "",
    onePerCustomer: false,
    active: true,
  });

  const selected = coupons.find((c) => c.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/appointments/service-booking/coupons");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not load discounts");
      setLoading(false);
      return;
    }
    const rows = (json.data || []) as CouponRow[];
    setCoupons(rows);
    if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    setDraft({
      code: selected.code,
      discountType: selected.discountType,
      discountValue: String(selected.discountValue),
      startsAt: selected.startsAt ? selected.startsAt.slice(0, 10) : "",
      expiresAt: selected.expiresAt ? selected.expiresAt.slice(0, 10) : "",
      usageCap: selected.usageCap != null ? String(selected.usageCap) : "",
      onePerCustomer: Boolean(selected.onePerCustomer),
      active: selected.active,
    });
  }, [selected]);

  async function saveCoupon() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/appointments/service-booking/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        code: draft.code.trim().toUpperCase(),
        discountType: draft.discountType,
        discountValue:
          draft.discountType === "percent"
            ? Number(draft.discountValue)
            : Math.round(Number(draft.discountValue) * 100),
        startsAt: draft.startsAt || undefined,
        expiresAt: draft.expiresAt || undefined,
        usageCap: draft.usageCap ? Number(draft.usageCap) : undefined,
        onePerCustomer: draft.onePerCustomer,
        active: draft.active,
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    setMessage("Discount saved");
    await load();
  }

  async function createCoupon() {
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: generateCode(),
        discountType: "percent",
        discountValue: 10,
        active: true,
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Create failed");
      return;
    }
    if (json.data?.id) setSelectedId(json.data.id);
    await load();
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading discounts…</p>;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 lg:flex-row">
      <div className="w-full lg:w-64 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Discounts</h1>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={() => void createCoupon()}
          >
            Create
          </button>
        </div>
        {coupons.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No discounts yet. Create a coupon code for checkout and POS.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {coupons.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`w-full p-3 text-left text-sm ${selectedId === row.id ? "bg-muted" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="font-medium">{row.code}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {row.discountType === "percent"
                      ? `${row.discountValue}% off`
                      : formatMoney(row.discountValue)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </p>
        ) : null}

        {!selected ? (
          <p className="text-sm text-muted-foreground">Select a discount to edit.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.code}</h2>
                <StatusBadge status={couponStatus(selected)} />
              </div>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveCoupon()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            <section className="rounded-lg border p-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span>Code</span>
                <div className="flex gap-2">
                  <input
                    className="rounded border px-3 py-2 flex-1"
                    value={draft.code}
                    onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="rounded border px-2 text-xs"
                    onClick={() => setDraft((d) => ({ ...d, code: generateCode() }))}
                  >
                    Generate
                  </button>
                </div>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Discount type</span>
                <select
                  className="rounded border px-3 py-2"
                  value={draft.discountType}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, discountType: e.target.value as "percent" | "fixed" }))
                  }
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{draft.discountType === "percent" ? "Percent off" : "Amount off (USD)"}</span>
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  min={0}
                  value={draft.discountValue}
                  onChange={(e) => setDraft((d) => ({ ...d, discountValue: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Usage limit (optional)</span>
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  min={1}
                  value={draft.usageCap}
                  onChange={(e) => setDraft((d) => ({ ...d, usageCap: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Valid from</span>
                <input
                  className="rounded border px-3 py-2"
                  type="date"
                  value={draft.startsAt}
                  onChange={(e) => setDraft((d) => ({ ...d, startsAt: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Expires</span>
                <input
                  className="rounded border px-3 py-2"
                  type="date"
                  value={draft.expiresAt}
                  onChange={(e) => setDraft((d) => ({ ...d, expiresAt: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.onePerCustomer}
                  onChange={(e) => setDraft((d) => ({ ...d, onePerCustomer: e.target.checked }))}
                />
                One use per customer
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                />
                Active
              </label>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
