"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommerceEmptyState } from "@/components/appointments/commerce/commerce-empty-state";
import { ContactSearchField, type ContactOption } from "@/components/appointments/commerce/contact-search-field";
import {
  formatDate,
  formatMoney,
  readLifecyclePolicy,
  sumPackageCredits,
  validityLabel,
} from "@/components/appointments/commerce/commerce-utils";
import type { PackageCreditRule, PackageLifecyclePolicy } from "@/lib/appointments/service-booking/types";
const API = "/api/appointments/service-booking/packages";
const TYPES_API = "/api/appointments/types";

type PackageRow = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  creditRules?: PackageCreditRule[];
  expirationDays?: number | null;
  active: boolean;
  directPurchase?: boolean;
  customerCount?: number;
  includedCredits?: number;
  metadata?: Record<string, unknown> | null;
};

type BalanceRow = {
  id: string;
  contactId: string;
  contactName: string;
  creditsRemaining: number;
  expiresAt?: string | null;
  status: string;
  createdAt: string;
  remainingCredits: Record<string, number>;
};

type BookingType = { id: string; name: string; kind?: string };

type LedgerRow = {
  id: string;
  kind: string;
  delta: Record<string, number>;
  note?: string | null;
  createdAt: string;
  appointmentId?: string | null;
};

function creditDeltaTotal(delta: Record<string, number>) {
  return Object.values(delta).reduce((s, n) => s + n, 0);
}

export function PackagesClient() {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [types, setTypes] = useState<BookingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PackageRow | null>(null);
  const [lifecycle, setLifecycle] = useState<PackageLifecyclePolicy>({});
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [sellOpen, setSellOpen] = useState(false);
  const [sellContact, setSellContact] = useState<ContactOption | null>(null);
  const [sellBusy, setSellBusy] = useState(false);

  const [adjustBalance, setAdjustBalance] = useState<BalanceRow | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<"add" | "remove">("add");
  const [adjustAmount, setAdjustAmount] = useState(1);
  const [adjustNote, setAdjustNote] = useState("Manual adjustment");

  const [ledgerBalance, setLedgerBalance] = useState<BalanceRow | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const selected = packages.find((p) => p.id === selectedId) || null;

  const loadPackages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgRes, typesRes] = await Promise.all([fetch(API), fetch(TYPES_API)]);
      const pkgJson = await pkgRes.json();
      const typesJson = await typesRes.json();
      if (!pkgRes.ok) throw new Error(pkgJson.error || "Failed to load packages");
      const rows = (pkgJson.data || []) as PackageRow[];
      setPackages(rows);
      setTypes((typesJson.data || typesJson || []) as BookingType[]);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadBalances = useCallback(async (productId: string) => {
    const res = await fetch(`${API}?productId=${encodeURIComponent(productId)}`);
    const json = await res.json();
    if (res.ok) setBalances(json.data || []);
  }, []);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      setBalances([]);
      return;
    }
    setDraft({ ...selected, creditRules: selected.creditRules || [] });
    setLifecycle(readLifecyclePolicy(selected.metadata));
    void loadBalances(selected.id);
  }, [selected, loadBalances]);

  const totalCredits = useMemo(
    () => sumPackageCredits(draft?.creditRules),
    [draft?.creditRules],
  );

  async function createPackage() {
    setSaving(true);
    setError(null);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New package",
        priceCents: 5000,
        creditRules: [{ quantity: 1, serviceName: "Session" }],
        active: false,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Create failed");
      return;
    }
    const created = json.data as PackageRow;
    await loadPackages();
    setSelectedId(created.id);
  }

  async function savePackage() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const metadata = {
      ...(draft.metadata || {}),
      lifecyclePolicy: lifecycle,
    };
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        metadata,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    setMessage("Package saved");
    await loadPackages();
  }

  async function duplicatePackage(id: string) {
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", productId: id }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error || "Duplicate failed");
      return;
    }
    await loadPackages();
    setSelectedId((json.data as PackageRow).id);
  }

  async function toggleActive(row: PackageRow) {
    await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, active: !row.active }),
    });
    await loadPackages();
  }

  async function sellPackage() {
    if (!draft || !sellContact) return;
    setSellBusy(true);
    setError(null);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "purchase",
        productId: draft.id,
        contactId: sellContact.id,
      }),
    });
    const json = await res.json();
    setSellBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not assign package");
      return;
    }
    setSellOpen(false);
    setSellContact(null);
    setMessage("Package assigned");
    await loadBalances(draft.id);
    await loadPackages();
  }

  async function confirmAdjust() {
    if (!adjustBalance) return;
    const key = Object.keys(adjustBalance.remainingCredits)[0] || "default";
    const signed = adjustDirection === "add" ? adjustAmount : -adjustAmount;
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "adjust",
        balanceId: adjustBalance.id,
        delta: { [key]: signed },
        note: adjustNote,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Adjustment failed");
      return;
    }
    setAdjustBalance(null);
    if (draft) await loadBalances(draft.id);
  }

  async function openLedger(balance: BalanceRow) {
    setLedgerBalance(balance);
    setLedgerLoading(true);
    const res = await fetch(`${API}?balanceId=${balance.id}&ledger=1`);
    const json = await res.json();
    setLedgerLoading(false);
    if (res.ok) setLedger(json.data || []);
  }

  function addCreditRule() {
    if (!draft) return;
    setDraft({
      ...draft,
      creditRules: [
        ...(draft.creditRules || []),
        { quantity: 1, bookingTypeId: types[0]?.id, label: types[0]?.name },
      ],
    });
  }

  function updateCreditRule(index: number, patch: Partial<PackageCreditRule>) {
    if (!draft) return;
    const rules = [...(draft.creditRules || [])];
    rules[index] = { ...rules[index], ...patch };
    setDraft({ ...draft, creditRules: rules });
  }

  function removeCreditRule(index: number) {
    if (!draft) return;
    const rules = [...(draft.creditRules || [])];
    rules.splice(index, 1);
    setDraft({ ...draft, creditRules: rules });
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading packages…</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Packages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sell a set number of services or classes together and track customer credits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setSellOpen(true)} disabled={!selected}>
            Sell / assign package
          </Button>
          <Button type="button" onClick={() => void createPackage()} disabled={saving}>
            Create package
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {packages.length === 0 ? (
        <CommerceEmptyState
          title="Sell multiple sessions together"
          description="Packages let customers prepay for a set number of services or classes."
          example="10 Personal Training Sessions"
          actionLabel="Create your first package"
          onAction={() => void createPackage()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section aria-label="Package list">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th scope="col" className="px-4 py-3 font-medium">Package</th>
                    <th scope="col" className="px-4 py-3 font-medium">Price</th>
                    <th scope="col" className="px-4 py-3 font-medium">Credits</th>
                    <th scope="col" className="px-4 py-3 font-medium">Customers</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b last:border-b-0 ${selectedId === row.id ? "bg-muted/50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="font-medium text-left text-primary underline-offset-2 hover:underline"
                          onClick={() => setSelectedId(row.id)}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-4 py-3">{formatMoney(row.priceCents)}</td>
                      <td className="px-4 py-3">{row.includedCredits ?? sumPackageCredits(row.creditRules)}</td>
                      <td className="px-4 py-3">{row.customerCount ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={row.active ? "text-foreground" : "text-muted-foreground"}>
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {draft ? (
            <section className="space-y-4" aria-label="Package editor">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">Edit package</h2>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void duplicatePackage(draft.id)}>
                    Duplicate
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void toggleActive(draft)}>
                    {draft.active ? "Disable" : "Enable"}
                  </Button>
                  <Button type="button" size="sm" onClick={() => void savePackage()} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">General</h3>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Package name</span>
                  <input
                    className="rounded-md border px-3 py-2"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Description</span>
                  <textarea
                    className="rounded-md border px-3 py-2"
                    rows={2}
                    value={draft.description || ""}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
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
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Included services &amp; classes</h3>
                    <p className="text-xs text-muted-foreground">
                      Choose what customers can use their package credits for.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCreditRule}>
                    Add service or class
                  </Button>
                </div>
                <ul className="space-y-2">
                  {(draft.creditRules || []).length === 0 ? (
                    <li className="text-sm text-muted-foreground">Add at least one eligible booking type.</li>
                  ) : (
                    draft.creditRules!.map((rule, index) => (
                      <li key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-[1fr_100px_auto]">
                        <label className="flex flex-col gap-1 text-sm">
                          <span>Booking type</span>
                          <select
                            className="rounded-md border px-2 py-2"
                            value={rule.bookingTypeId || ""}
                            onChange={(e) => {
                              const type = types.find((t) => t.id === e.target.value);
                              updateCreditRule(index, {
                                bookingTypeId: e.target.value,
                                label: type?.name,
                                serviceName: type?.name,
                              });
                            }}
                          >
                            <option value="">Select…</option>
                            {types.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm">
                          <span>Credits used</span>
                          <input
                            type="number"
                            min={1}
                            className="rounded-md border px-2 py-2"
                            value={rule.quantity}
                            onChange={(e) =>
                              updateCreditRule(index, { quantity: Math.max(1, Number(e.target.value) || 1) })
                            }
                          />
                        </label>
                        <div className="flex items-end">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCreditRule(index)}>
                            Remove
                          </Button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Package includes {totalCredits} total starting credits across rules.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Price &amp; purchase</h3>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Price</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="rounded-md border px-3 py-2"
                    value={(draft.priceCents / 100).toFixed(2)}
                    onChange={(e) =>
                      setDraft({ ...draft, priceCents: Math.round(Number(e.target.value) * 100) || 0 })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.directPurchase ?? true}
                    onChange={(e) => setDraft({ ...draft, directPurchase: e.target.checked })}
                  />
                  Customers can buy this package
                </label>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Validity</h3>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Expires after purchase (days)</span>
                  <input
                    type="number"
                    min={0}
                    className="rounded-md border px-3 py-2"
                    placeholder="Leave empty for no expiration"
                    value={draft.expirationDays ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraft({
                        ...draft,
                        expirationDays: v === "" ? null : Math.max(0, Number(v) || 0),
                      });
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">{validityLabel(draft.expirationDays)}</p>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Credit rules</h3>
                <p className="text-xs text-muted-foreground">
                  Choose what happens to credits when an appointment changes. Service/class policies define timing.
                </p>
                <fieldset className="space-y-2 text-sm">
                  <legend className="font-medium">When a customer cancels in time</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="cancel-policy"
                      checked={lifecycle.restoreCreditsOnCancel !== false}
                      onChange={() => setLifecycle({ ...lifecycle, restoreCreditsOnCancel: true })}
                    />
                    Return the credit
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="cancel-policy"
                      checked={lifecycle.restoreCreditsOnCancel === false}
                      onChange={() => setLifecycle({ ...lifecycle, restoreCreditsOnCancel: false })}
                    />
                    Keep the credit used
                  </label>
                </fieldset>
                <fieldset className="space-y-2 text-sm">
                  <legend className="font-medium">Late cancellation</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="late-cancel"
                      checked={lifecycle.restoreCreditsOnLateCancel === true}
                      onChange={() => setLifecycle({ ...lifecycle, restoreCreditsOnLateCancel: true })}
                    />
                    Return the credit
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="late-cancel"
                      checked={lifecycle.restoreCreditsOnLateCancel !== true}
                      onChange={() => setLifecycle({ ...lifecycle, restoreCreditsOnLateCancel: false })}
                    />
                    Forfeit the credit
                  </label>
                </fieldset>
                <fieldset className="space-y-2 text-sm">
                  <legend className="font-medium">No-show</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="no-show"
                      checked={lifecycle.restoreCreditsOnNoShow === true}
                      onChange={() => setLifecycle({ ...lifecycle, restoreCreditsOnNoShow: true })}
                    />
                    Return the credit
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="no-show"
                      checked={lifecycle.restoreCreditsOnNoShow !== true}
                      onChange={() => setLifecycle({ ...lifecycle, restoreCreditsOnNoShow: false })}
                    />
                    Forfeit the credit
                  </label>
                </fieldset>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Customers &amp; credits</h3>
                {balances.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No customers own this package yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th scope="col" className="py-2 pr-3 font-medium">Customer</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Purchased</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Credits</th>
                          <th scope="col" className="py-2 pr-3 font-medium">Expires</th>
                          <th scope="col" className="py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {balances.map((b) => (
                          <tr key={b.id} className="border-b last:border-b-0">
                            <td className="py-2 pr-3">
                              <Link href={`/contacts/${b.contactId}`} className="text-primary underline">
                                {b.contactName}
                              </Link>
                            </td>
                            <td className="py-2 pr-3">{formatDate(b.createdAt)}</td>
                            <td className="py-2 pr-3">{b.creditsRemaining}</td>
                            <td className="py-2 pr-3">{formatDate(b.expiresAt)}</td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="text-xs text-primary underline"
                                  onClick={() => setAdjustBalance(b)}
                                >
                                  Adjust credits
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-primary underline"
                                  onClick={() => void openLedger(b)}
                                >
                                  Credit history
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {sellOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-medium">Sell / assign package</h2>
            <ContactSearchField selected={sellContact} onSelect={setSellContact} />
            <p className="text-sm text-muted-foreground">
              {draft?.name} · {totalCredits} starting credits · {validityLabel(draft?.expirationDays)}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSellOpen(false)}>Cancel</Button>
              <Button type="button" onClick={() => void sellPackage()} disabled={!sellContact || sellBusy}>
                {sellBusy ? "Assigning…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {adjustBalance ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-medium">Adjust credits</h2>
            <p className="text-sm">Current balance: {adjustBalance.creditsRemaining}</p>
            <fieldset className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={adjustDirection === "add"}
                  onChange={() => setAdjustDirection("add")}
                />
                Add
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={adjustDirection === "remove"}
                  onChange={() => setAdjustDirection("remove")}
                />
                Remove
              </label>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm">
              <span>Amount</span>
              <input
                type="number"
                min={1}
                className="rounded-md border px-3 py-2"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Note</span>
              <input
                className="rounded-md border px-3 py-2"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </label>
            <p className="text-sm text-muted-foreground">
              New balance:{" "}
              {adjustBalance.creditsRemaining +
                (adjustDirection === "add" ? adjustAmount : -adjustAmount)}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdjustBalance(null)}>Cancel</Button>
              <Button type="button" onClick={() => void confirmAdjust()} disabled={saving}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {ledgerBalance ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-medium">Credit history — {ledgerBalance.contactName}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLedgerBalance(null)}>
                Close
              </Button>
            </div>
            {ledgerLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            ) : ledger.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th scope="col" className="py-2 pr-2 font-medium">Date</th>
                    <th scope="col" className="py-2 pr-2 font-medium">Activity</th>
                    <th scope="col" className="py-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">{formatDate(entry.createdAt)}</td>
                      <td className="py-2 pr-2">{entry.note || entry.kind}</td>
                      <td className="py-2">{creditDeltaTotal(entry.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
