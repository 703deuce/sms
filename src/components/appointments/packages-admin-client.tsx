"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PackageCreditRule, PackageLifecyclePolicy } from "@/lib/appointments/service-booking/types";
import {
  ContactSearchField,
  formatMoney,
  StatusBadge,
  type ContactOption,
} from "@/components/appointments/commerce-admin-shared";

type PackageRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceCents: number;
  creditRules: PackageCreditRule[];
  expirationDays?: number | null;
  active: boolean;
  metadata?: { packageLifecycle?: PackageLifecyclePolicy } | null;
};

type BookingTypeOption = { id: string; name: string; kind?: string };

type PurchaseRow = {
  id: string;
  contactId: string;
  status: string;
  remainingCredits: Record<string, number>;
  expiresAt?: string | null;
  createdAt: string;
  contact?: { id: string; firstName?: string | null; lastName?: string | null; phone: string } | null;
};

const DEFAULT_LIFECYCLE: PackageLifecyclePolicy = {
  restoreCreditsOnCancel: true,
  restoreCreditsOnLateCancel: false,
  restoreCreditsOnNoShow: false,
};

function totalCredits(rules: PackageCreditRule[]) {
  return rules.reduce((sum, rule) => sum + (rule.quantity || 0), 0);
}

function contactLabel(contact?: PurchaseRow["contact"]) {
  if (!contact) return "Customer";
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.phone;
}

export function PackagesAdminClient() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [bookingTypes, setBookingTypes] = useState<BookingTypeOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showSell, setShowSell] = useState(false);
  const [sellContact, setSellContact] = useState<ContactOption | null>(null);

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    priceDollars: "",
    expirationDays: "",
    active: true,
    creditRules: [] as PackageCreditRule[],
    lifecycle: DEFAULT_LIFECYCLE,
  });

  const selected = packages.find((p) => p.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgRes, typesRes] = await Promise.all([
        fetch("/api/appointments/service-booking/packages"),
        fetch("/api/appointments/types"),
      ]);
      const pkgJson = await pkgRes.json();
      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      if (!pkgRes.ok) throw new Error(pkgJson.error || "Could not load packages");
      const rows = (pkgJson.data || []) as PackageRow[];
      setPackages(rows);
      setBookingTypes(
        (typesJson.data || []).map((t: { id: string; name: string; kind?: string }) => ({
          id: t.id,
          name: t.name,
          kind: t.kind,
        })),
      );
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadPurchases = useCallback(async (productId: string) => {
    const res = await fetch(
      `/api/appointments/service-booking/packages?action=purchases&productId=${encodeURIComponent(productId)}`,
    );
    const json = await res.json();
    if (res.ok) setPurchases((json.data || []) as PurchaseRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    const lifecycle =
      (selected.metadata as { packageLifecycle?: PackageLifecyclePolicy } | null)?.packageLifecycle ||
      DEFAULT_LIFECYCLE;
    setDraft({
      name: selected.name,
      description: selected.description || "",
      priceDollars: (selected.priceCents / 100).toFixed(2),
      expirationDays: selected.expirationDays != null ? String(selected.expirationDays) : "",
      active: selected.active,
      creditRules: Array.isArray(selected.creditRules) ? selected.creditRules : [],
      lifecycle: { ...DEFAULT_LIFECYCLE, ...lifecycle },
    });
    void loadPurchases(selected.id);
  }, [selected, loadPurchases]);

  async function savePackage() {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    const res = await fetch("/api/appointments/service-booking/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        priceCents: Math.round(Number(draft.priceDollars || 0) * 100),
        expirationDays: draft.expirationDays ? Number(draft.expirationDays) : undefined,
        active: draft.active,
        creditRules: draft.creditRules,
        packageLifecycle: draft.lifecycle,
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    setMessage("Package saved");
    await load();
  }

  async function createPackage() {
    const name = window.prompt("Package name");
    if (!name?.trim()) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        priceCents: 0,
        creditRules: [{ quantity: 1, label: "Session", serviceName: "default" }],
        packageLifecycle: DEFAULT_LIFECYCLE,
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

  async function sellPackage() {
    if (!selected || !sellContact) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/appointments/service-booking/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "purchase",
        productId: selected.id,
        contactId: sellContact.id,
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not issue package");
      return;
    }
    setMessage(`Package issued to ${sellContact.name}`);
    setShowSell(false);
    setSellContact(null);
    await loadPurchases(selected.id);
  }

  function updateCreditRule(index: number, patch: Partial<PackageCreditRule>) {
    setDraft((prev) => ({
      ...prev,
      creditRules: prev.creditRules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    }));
  }

  function addCreditRule() {
    setDraft((prev) => ({
      ...prev,
      creditRules: [
        ...prev.creditRules,
        { quantity: 1, bookingTypeId: bookingTypes[0]?.id, label: bookingTypes[0]?.name || "Session" },
      ],
    }));
  }

  const eligibleSummary = useMemo(
    () =>
      draft.creditRules
        .map((rule) => {
          const typeName =
            bookingTypes.find((t) => t.id === rule.bookingTypeId)?.name ||
            rule.label ||
            rule.serviceName ||
            "Item";
          return `${typeName} (${rule.quantity} credit${rule.quantity === 1 ? "" : "s"})`;
        })
        .join(", "),
    [draft.creditRules, bookingTypes],
  );

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading packages…</p>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:flex-row">
      <div className="w-full lg:w-72 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Packages</h1>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={() => void createPackage()}
          >
            Create
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Sell session bundles with mixed eligibility, expiration, and cancellation credit rules.
        </p>
        {packages.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No packages yet. Create your first package to sell credits.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {packages.map((pkg) => (
              <li key={pkg.id}>
                <button
                  type="button"
                  className={`w-full p-3 text-left text-sm ${selectedId === pkg.id ? "bg-muted" : ""}`}
                  onClick={() => setSelectedId(pkg.id)}
                >
                  <span className="font-medium">{pkg.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatMoney(pkg.priceCents)} · {totalCredits(pkg.creditRules || [])} credits
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
          <p className="text-sm text-muted-foreground">Select a package to edit.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-sm"
                  onClick={() => setShowSell((v) => !v)}
                >
                  Sell to customer
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void savePackage()}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            {showSell ? (
              <section className="rounded-lg border p-4 space-y-3">
                <h3 className="text-sm font-semibold">Issue package</h3>
                <p className="text-xs text-muted-foreground">
                  Uses the same purchase backend as POS and public store — entitlements are created immediately.
                </p>
                <ContactSearchField selected={sellContact} onSelect={setSellContact} />
                <button
                  type="button"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                  disabled={!sellContact || saving}
                  onClick={() => void sellPackage()}
                >
                  Issue at {formatMoney(Math.round(Number(draft.priceDollars || 0) * 100))}
                </button>
              </section>
            ) : null}

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">General</h3>
              <label className="flex flex-col gap-1 text-sm">
                <span>Name</span>
                <input
                  className="rounded border px-3 py-2"
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Description</span>
                <textarea
                  className="rounded border px-3 py-2"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                />
                Active — available for purchase
              </label>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Pricing</h3>
              <label className="flex flex-col gap-1 text-sm max-w-xs">
                <span>Price</span>
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  min={0}
                  step={0.01}
                  value={draft.priceDollars}
                  onChange={(e) => setDraft((d) => ({ ...d, priceDollars: e.target.value }))}
                />
              </label>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Credits & eligibility</h3>
                <button type="button" className="text-xs underline" onClick={addCreditRule}>
                  Add eligible item
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{eligibleSummary || "No eligible items yet."}</p>
              <ul className="space-y-3">
                {draft.creditRules.map((rule, index) => (
                  <li key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                      <span>Eligible booking</span>
                      <select
                        className="rounded border px-3 py-2"
                        value={rule.bookingTypeId || ""}
                        onChange={(e) => {
                          const type = bookingTypes.find((t) => t.id === e.target.value);
                          updateCreditRule(index, {
                            bookingTypeId: e.target.value,
                            label: type?.name,
                            serviceName: undefined,
                          });
                        }}
                      >
                        <option value="">Select service or class…</option>
                        {bookingTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>Credits per use</span>
                      <input
                        className="rounded border px-3 py-2"
                        type="number"
                        min={1}
                        value={rule.quantity}
                        onChange={(e) => updateCreditRule(index, { quantity: Number(e.target.value) || 1 })}
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-destructive sm:col-span-3 text-left"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          creditRules: d.creditRules.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Expiration</h3>
              <label className="flex flex-col gap-1 text-sm max-w-xs">
                <span>Expires after purchase (days, optional)</span>
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  min={1}
                  value={draft.expirationDays}
                  onChange={(e) => setDraft((d) => ({ ...d, expirationDays: e.target.value }))}
                  placeholder="No expiration"
                />
              </label>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Cancellation credit policy</h3>
              <p className="text-xs text-muted-foreground">
                Controls whether used package credits return when an appointment is canceled, late-canceled, or marked
                no-show. Cash policy fees are configured per booking type.
              </p>
              <fieldset className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="cancel-policy"
                    checked={draft.lifecycle.restoreCreditsOnCancel !== false}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        lifecycle: { ...d.lifecycle, restoreCreditsOnCancel: true },
                      }))
                    }
                  />
                  Return credit on standard cancellation
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="cancel-policy"
                    checked={draft.lifecycle.restoreCreditsOnCancel === false}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        lifecycle: { ...d.lifecycle, restoreCreditsOnCancel: false },
                      }))
                    }
                  />
                  Keep credit on cancellation
                </label>
              </fieldset>
              <fieldset className="space-y-2 text-sm">
                <p className="font-medium">Late cancellation</p>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={draft.lifecycle.restoreCreditsOnLateCancel === true}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        lifecycle: { ...d.lifecycle, restoreCreditsOnLateCancel: true },
                      }))
                    }
                  />
                  Return used credit
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={draft.lifecycle.restoreCreditsOnLateCancel !== true}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        lifecycle: { ...d.lifecycle, restoreCreditsOnLateCancel: false },
                      }))
                    }
                  />
                  Keep used credit (forfeit)
                </label>
              </fieldset>
              <fieldset className="space-y-2 text-sm">
                <p className="font-medium">No-show</p>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={draft.lifecycle.restoreCreditsOnNoShow === true}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        lifecycle: { ...d.lifecycle, restoreCreditsOnNoShow: true },
                      }))
                    }
                  />
                  Return used credit
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={draft.lifecycle.restoreCreditsOnNoShow !== true}
                    onChange={() =>
                      setDraft((d) => ({
                        ...d,
                        lifecycle: { ...d.lifecycle, restoreCreditsOnNoShow: false },
                      }))
                    }
                  />
                  Keep used credit (forfeit)
                </label>
              </fieldset>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Purchases</h3>
              {purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No purchases yet for this package.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-2 pr-3" scope="col">Customer</th>
                        <th className="py-2 pr-3" scope="col">Purchased</th>
                        <th className="py-2 pr-3" scope="col">Remaining</th>
                        <th className="py-2 pr-3" scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((row) => {
                        const remaining = Object.values(row.remainingCredits || {}).reduce(
                          (s, n) => s + Math.max(0, Number(n) || 0),
                          0,
                        );
                        return (
                          <tr key={row.id} className="border-b">
                            <td className="py-2 pr-3">
                              <Link href={`/contacts/${row.contactId}`} className="underline">
                                {contactLabel(row.contact)}
                              </Link>
                            </td>
                            <td className="py-2 pr-3">{new Date(row.createdAt).toLocaleDateString()}</td>
                            <td className="py-2 pr-3">{remaining}</td>
                            <td className="py-2 pr-3"><StatusBadge status={row.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
