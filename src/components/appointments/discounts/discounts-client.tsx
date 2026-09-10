"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommerceEmptyState } from "@/components/appointments/commerce/commerce-empty-state";
import { formatDate, formatMoney } from "@/components/appointments/commerce/commerce-utils";

const API = "/api/appointments/service-booking/coupons";
const TYPES_API = "/api/appointments/types";

type DiscountRow = {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageCap?: number | null;
  onePerCustomer?: boolean;
  eligibleTargets?: Record<string, unknown>;
  active: boolean;
};

type BookingType = { id: string; name: string };

type UsageSummary = { used: number; remaining: number | null };

function discountLabel(row: DiscountRow) {
  if (row.discountType === "percent") return `${row.discountValue}% off`;
  return formatMoney(row.discountValue);
}

export function DiscountsClient() {
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [types, setTypes] = useState<BookingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DiscountRow | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = discounts.find((d) => d.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    const [discRes, typesRes] = await Promise.all([fetch(API), fetch(TYPES_API)]);
    const discJson = await discRes.json();
    const typesJson = await typesRes.json();
    const rows = (discJson.data || []) as DiscountRow[];
    setDiscounts(rows);
    setTypes((typesJson.data || typesJson || []) as BookingType[]);
    if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    setLoading(false);
  }, [selectedId]);

  const loadUsage = useCallback(async (couponId: string) => {
    const res = await fetch(`${API}?couponId=${encodeURIComponent(couponId)}&usage=1`);
    const json = await res.json();
    if (res.ok) setUsage(json.data as UsageSummary);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      setUsage(null);
      return;
    }
    setDraft({ ...selected });
    void loadUsage(selected.id);
  }, [selected, loadUsage]);

  async function createDiscount() {
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: `SAVE${Date.now().toString().slice(-4)}`,
        discountType: "percent",
        discountValue: 10,
        active: false,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Create failed");
      return;
    }
    await load();
    setSelectedId((json.data as DiscountRow).id);
  }

  async function saveDiscount() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Save failed");
      return;
    }
    await load();
    if (draft.id) await loadUsage(draft.id);
  }

  function toggleTypeEligibility(typeId: string, checked: boolean) {
    if (!draft) return;
    const targets = (draft.eligibleTargets || {}) as { typeIds?: string[] };
    const typeIds = new Set(targets.typeIds || []);
    if (checked) typeIds.add(typeId);
    else typeIds.delete(typeId);
    setDraft({
      ...draft,
      eligibleTargets: { ...targets, typeIds: [...typeIds] },
    });
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading discounts…</p>;

  const eligibleTypeIds = ((draft?.eligibleTargets || {}) as { typeIds?: string[] }).typeIds || [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Discounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create promo codes and price reductions for eligible bookings or purchases.
          </p>
        </div>
        <Button type="button" onClick={() => void createDiscount()} disabled={saving}>
          Create discount
        </Button>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {discounts.length === 0 ? (
        <CommerceEmptyState
          title="Create your first discount"
          description="Offer percentage or fixed discounts on services, classes, packages, and more."
          example="WELCOME20"
          actionLabel="Create discount"
          onAction={() => void createDiscount()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <table className="w-full rounded-lg border text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 font-medium">Discount</th>
                <th scope="col" className="px-4 py-3 font-medium">Dates</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((row) => (
                <tr key={row.id} className={`border-b ${selectedId === row.id ? "bg-muted/50" : ""}`}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {row.code}
                    </button>
                  </td>
                  <td className="px-4 py-3">{discountLabel(row)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(row.startsAt)} – {formatDate(row.expiresAt)}
                  </td>
                  <td className="px-4 py-3">{row.active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {draft ? (
            <section className="space-y-4 rounded-lg border p-4">
              <div className="flex justify-between gap-2">
                <h2 className="text-sm font-semibold">Edit discount</h2>
                <Button type="button" size="sm" onClick={() => void saveDiscount()} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>

              {usage ? (
                <p className="text-sm text-muted-foreground">
                  {usage.used} uses
                  {usage.remaining != null ? ` · ${usage.remaining} remaining` : " · Unlimited use"}
                </p>
              ) : null}

              <label className="flex flex-col gap-1 text-sm">
                <span>Coupon code</span>
                <input
                  className="rounded-md border px-3 py-2 uppercase"
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Active
              </label>

              <fieldset className="space-y-2 text-sm">
                <legend className="font-medium">Discount value</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={draft.discountType === "percent"}
                    onChange={() => setDraft({ ...draft, discountType: "percent" })}
                  />
                  Percentage
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={draft.discountType === "fixed"}
                    onChange={() => setDraft({ ...draft, discountType: "fixed" })}
                  />
                  Fixed amount
                </label>
                <input
                  type="number"
                  min={0}
                  className="rounded-md border px-3 py-2"
                  value={draft.discountValue}
                  onChange={(e) =>
                    setDraft({ ...draft, discountValue: Number(e.target.value) || 0 })
                  }
                />
              </fieldset>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Applies to</h3>
                <ul className="max-h-40 space-y-1 overflow-auto rounded border p-2 text-sm">
                  {types.map((t) => (
                    <li key={t.id}>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={eligibleTypeIds.includes(t.id)}
                          onChange={(e) => toggleTypeEligibility(t.id, e.target.checked)}
                        />
                        {t.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Start date</span>
                  <input
                    type="date"
                    className="rounded-md border px-3 py-2"
                    value={draft.startsAt ? draft.startsAt.slice(0, 10) : ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>End date</span>
                  <input
                    type="date"
                    className="rounded-md border px-3 py-2"
                    value={draft.expiresAt ? draft.expiresAt.slice(0, 10) : ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span>Usage limit</span>
                <input
                  type="number"
                  min={0}
                  className="rounded-md border px-3 py-2"
                  placeholder="Unlimited"
                  value={draft.usageCap ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      usageCap: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.onePerCustomer ?? false}
                  onChange={(e) => setDraft({ ...draft, onePerCustomer: e.target.checked })}
                />
                One use per customer
              </label>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
