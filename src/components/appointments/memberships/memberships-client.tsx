"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommerceEmptyState } from "@/components/appointments/commerce/commerce-empty-state";
import { ContactSearchField, type ContactOption } from "@/components/appointments/commerce/contact-search-field";
import {
  billingIntervalLabel,
  formatDate,
  formatMoney,
  membershipStatusLabel,
  readMembershipLifecycle,
} from "@/components/appointments/commerce/commerce-utils";
import type { MembershipBenefits, PackageCreditRule } from "@/lib/appointments/service-booking/types";

const API = "/api/appointments/service-booking/memberships";
const TYPES_API = "/api/appointments/types";

type MembershipRow = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  billingInterval: string;
  benefits?: MembershipBenefits;
  active: boolean;
  memberCount?: number;
  benefitsSummary?: string;
  metadata?: Record<string, unknown> | null;
};

type SubscriptionRow = {
  id: string;
  contactId: string;
  contactName: string;
  status: string;
  createdAt: string;
  currentPeriodEnd?: string | null;
  creditAllowance?: number;
};

type BookingType = { id: string; name: string };

export function MembershipsClient() {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [types, setTypes] = useState<BookingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MembershipRow | null>(null);
  const [lifecycle, setLifecycle] = useState(readMembershipLifecycle(null));
  const [members, setMembers] = useState<SubscriptionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollContact, setEnrollContact] = useState<ContactOption | null>(null);
  const [enrollBusy, setEnrollBusy] = useState(false);

  const selected = memberships.find((m) => m.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memRes, typesRes] = await Promise.all([fetch(API), fetch(TYPES_API)]);
      const memJson = await memRes.json();
      const typesJson = await typesRes.json();
      const rows = (memJson.data || []) as MembershipRow[];
      setMemberships(rows);
      setTypes((typesJson.data || typesJson || []) as BookingType[]);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadMembers = useCallback(async (productId: string) => {
    const res = await fetch(`${API}?productId=${encodeURIComponent(productId)}`);
    const json = await res.json();
    if (res.ok) setMembers(json.data || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      setMembers([]);
      return;
    }
    setDraft({ ...selected, benefits: selected.benefits || {} });
    setLifecycle(readMembershipLifecycle(selected.metadata));
    void loadMembers(selected.id);
  }, [selected, loadMembers]);

  async function createMembership() {
    setSaving(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New membership",
        priceCents: 14900,
        billingInterval: "month",
        benefits: { includedCredits: [] },
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
    setSelectedId((json.data as MembershipRow).id);
  }

  async function saveMembership() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const metadata = { ...(draft.metadata || {}), lifecycle };
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, metadata }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Save failed");
      return;
    }
    setMessage("Membership saved");
    await load();
  }

  async function membershipAction(
    subscriptionId: string,
    action: "pause" | "resume" | "cancel",
    mode?: "immediate" | "end_of_period",
  ) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, subscriptionId, mode }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Action failed");
      return;
    }
    if (draft) await loadMembers(draft.id);
  }

  async function enrollMember() {
    if (!draft || !enrollContact) return;
    setEnrollBusy(true);
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        productId: draft.id,
        contactId: enrollContact.id,
      }),
    });
    setEnrollBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not enroll member");
      return;
    }
    setEnrollOpen(false);
    setEnrollContact(null);
    setMessage("Member enrolled");
    await loadMembers(draft.id);
    await load();
  }

  function addIncludedCredits() {
    if (!draft) return;
    const benefits = draft.benefits || {};
    const rules = [...(benefits.includedCredits || [])];
    rules.push({ quantity: 4, bookingTypeId: types[0]?.id, label: types[0]?.name });
    setDraft({ ...draft, benefits: { ...benefits, includedCredits: rules } });
  }

  function updateCreditRule(index: number, patch: Partial<PackageCreditRule>) {
    if (!draft) return;
    const benefits = draft.benefits || {};
    const rules = [...(benefits.includedCredits || [])];
    rules[index] = { ...rules[index], ...patch };
    setDraft({ ...draft, benefits: { ...benefits, includedCredits: rules } });
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading memberships…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Memberships</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create recurring memberships with included credits, discounts, or member-only access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setEnrollOpen(true)} disabled={!selected}>
            Add member
          </Button>
          <Button type="button" onClick={() => void createMembership()} disabled={saving}>
            Create membership
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {memberships.length === 0 ? (
        <CommerceEmptyState
          title="Create recurring memberships"
          description="Charge customers regularly and include credits, discounts, or access to member-only bookings."
          example="4 Training Sessions Per Month"
          actionLabel="Create your first membership"
          onAction={() => void createMembership()}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th scope="col" className="px-4 py-3 font-medium">Membership</th>
                  <th scope="col" className="px-4 py-3 font-medium">Price</th>
                  <th scope="col" className="px-4 py-3 font-medium">Benefits</th>
                  <th scope="col" className="px-4 py-3 font-medium">Members</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((row) => (
                  <tr key={row.id} className={`border-b ${selectedId === row.id ? "bg-muted/50" : ""}`}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => setSelectedId(row.id)}
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(row.priceCents)} / {billingIntervalLabel(row.billingInterval).toLowerCase()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.benefitsSummary || "—"}</td>
                    <td className="px-4 py-3">{row.memberCount ?? 0}</td>
                    <td className="px-4 py-3">{row.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {draft ? (
            <section className="space-y-4">
              <div className="flex justify-between gap-2">
                <h2 className="text-lg font-medium">Edit membership</h2>
                <Button type="button" size="sm" onClick={() => void saveMembership()} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">General</h3>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Name</span>
                  <input
                    className="rounded-md border px-3 py-2"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
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
                <h3 className="text-sm font-semibold">Billing</h3>
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
                <label className="flex flex-col gap-1 text-sm">
                  <span>Billing frequency</span>
                  <select
                    className="rounded-md border px-3 py-2"
                    value={draft.billingInterval}
                    onChange={(e) => setDraft({ ...draft, billingInterval: e.target.value })}
                  >
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly</option>
                    <option value="year">Yearly</option>
                  </select>
                </label>
                <p className="text-xs text-muted-foreground">
                  Recurring billing requires a connected payment provider (Stripe).
                </p>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex justify-between gap-2">
                  <h3 className="text-sm font-semibold">Benefits</h3>
                  <Button type="button" variant="outline" size="sm" onClick={addIncludedCredits}>
                    Add included credits
                  </Button>
                </div>
                <ul className="space-y-2">
                  {(draft.benefits?.includedCredits || []).map((rule, index) => (
                    <li key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
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
                            });
                          }}
                        >
                          {types.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>Credits each billing cycle</span>
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
                    </li>
                  ))}
                </ul>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Member discount (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="rounded-md border px-3 py-2"
                    value={draft.benefits?.percentDiscount ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        benefits: {
                          ...draft.benefits,
                          percentDiscount: e.target.value === "" ? undefined : Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Membership lifecycle</h3>
                <label className="flex flex-col gap-1 text-sm">
                  <span>Default cancellation</span>
                  <select
                    className="rounded-md border px-3 py-2"
                    value={lifecycle.cancelMode}
                    onChange={(e) =>
                      setLifecycle({
                        ...lifecycle,
                        cancelMode: e.target.value as "immediate" | "end_of_period",
                      })
                    }
                  >
                    <option value="end_of_period">Cancel at end of billing period</option>
                    <option value="immediate">Cancel immediately</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lifecycle.pauseAllowed}
                    onChange={(e) => setLifecycle({ ...lifecycle, pauseAllowed: e.target.checked })}
                  />
                  Allow memberships to be paused
                </label>
                <fieldset className="space-y-2 text-sm">
                  <legend className="font-medium">When a membership payment fails</legend>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="failed-pay"
                      checked={lifecycle.failedPaymentBehavior === "suspend"}
                      onChange={() => setLifecycle({ ...lifecycle, failedPaymentBehavior: "suspend" })}
                    />
                    Suspend membership benefits until payment succeeds
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="failed-pay"
                      checked={lifecycle.failedPaymentBehavior === "grace"}
                      onChange={() => setLifecycle({ ...lifecycle, failedPaymentBehavior: "grace" })}
                    />
                    Keep benefits active during grace period
                  </label>
                </fieldset>
                <p className="text-xs text-muted-foreground">
                  Benefits are restored automatically after a successful payment.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">Members</h3>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th scope="col" className="py-2 pr-2 font-medium">Customer</th>
                        <th scope="col" className="py-2 pr-2 font-medium">Status</th>
                        <th scope="col" className="py-2 pr-2 font-medium">Started</th>
                        <th scope="col" className="py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} className="border-b last:border-b-0">
                          <td className="py-2 pr-2">
                            <Link href={`/contacts/${m.contactId}`} className="text-primary underline">
                              {m.contactName}
                            </Link>
                            {m.status === "past_due" ? (
                              <span className="ml-2 text-xs text-amber-700">Payment issue</span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-2">{membershipStatusLabel(m.status)}</td>
                          <td className="py-2 pr-2">{formatDate(m.createdAt)}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {m.status === "active" ? (
                                <button
                                  type="button"
                                  className="text-primary underline"
                                  onClick={() => void membershipAction(m.id, "pause")}
                                >
                                  Pause
                                </button>
                              ) : null}
                              {m.status === "paused" ? (
                                <button
                                  type="button"
                                  className="text-primary underline"
                                  onClick={() => void membershipAction(m.id, "resume")}
                                >
                                  Resume
                                </button>
                              ) : null}
                              {m.status !== "canceled" ? (
                                <button
                                  type="button"
                                  className="text-primary underline"
                                  onClick={() => void membershipAction(m.id, "cancel", "end_of_period")}
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {enrollOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg">
            <h2 className="text-lg font-medium">Add member</h2>
            <ContactSearchField selected={enrollContact} onSelect={setEnrollContact} />
            <p className="text-sm text-muted-foreground">
              {draft?.name} · {formatMoney(draft?.priceCents || 0)} / {draft?.billingInterval}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
              <Button type="button" onClick={() => void enrollMember()} disabled={!enrollContact || enrollBusy}>
                {enrollBusy ? "Enrolling…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
