"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MembershipBenefits, PackageCreditRule } from "@/lib/appointments/service-booking/types";
import {
  ContactSearchField,
  formatMoney,
  StatusBadge,
  type ContactOption,
} from "@/components/appointments/commerce-admin-shared";

type MembershipRow = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  billingInterval: string;
  active: boolean;
  benefits: MembershipBenefits;
  metadata?: {
    creditReplenishment?: { expireUnused?: boolean; rollover?: boolean };
  } | null;
};

type MemberRow = {
  id: string;
  contactId: string;
  status: string;
  currentPeriodEnd?: string | null;
  createdAt: string;
  contact?: { id: string; firstName?: string | null; lastName?: string | null; phone: string } | null;
};

type BookingTypeOption = { id: string; name: string };

function contactLabel(contact?: MemberRow["contact"]) {
  if (!contact) return "Member";
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.phone;
}

export function MembershipsAdminClient() {
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [bookingTypes, setBookingTypes] = useState<BookingTypeOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sellContact, setSellContact] = useState<ContactOption | null>(null);

  const [draft, setDraft] = useState({
    name: "",
    description: "",
    priceDollars: "",
    billingInterval: "month",
    active: true,
    includedCredits: [] as PackageCreditRule[],
    memberOnlyTypeIds: [] as string[],
    expireUnusedCredits: true,
    rolloverCredits: false,
  });

  const selected = memberships.find((m) => m.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [memRes, typesRes] = await Promise.all([
        fetch("/api/appointments/service-booking/memberships"),
        fetch("/api/appointments/types"),
      ]);
      const memJson = await memRes.json();
      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      if (!memRes.ok) throw new Error(memJson.error || "Could not load memberships");
      const rows = (memJson.data || []) as MembershipRow[];
      setMemberships(rows);
      setBookingTypes((typesJson.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })));
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadMembers = useCallback(async (productId: string) => {
    const res = await fetch(
      `/api/appointments/service-booking/memberships?action=members&productId=${encodeURIComponent(productId)}`,
    );
    const json = await res.json();
    if (res.ok) setMembers((json.data || []) as MemberRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    const benefits = (selected.benefits || {}) as MembershipBenefits;
    const replenishment = selected.metadata?.creditReplenishment;
    setDraft({
      name: selected.name,
      description: selected.description || "",
      priceDollars: (selected.priceCents / 100).toFixed(2),
      billingInterval: selected.billingInterval || "month",
      active: selected.active,
      includedCredits: benefits.includedCredits || [],
      memberOnlyTypeIds: benefits.memberOnlyTypeIds || [],
      expireUnusedCredits: replenishment?.expireUnused !== false,
      rolloverCredits: replenishment?.rollover === true,
    });
    void loadMembers(selected.id);
  }, [selected, loadMembers]);

  async function saveMembership() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    const benefits: MembershipBenefits = {
      includedCredits: draft.includedCredits,
      memberOnlyTypeIds: draft.memberOnlyTypeIds,
    };
    const res = await fetch("/api/appointments/service-booking/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.id,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        priceCents: Math.round(Number(draft.priceDollars || 0) * 100),
        billingInterval: draft.billingInterval,
        active: draft.active,
        benefits,
        metadata: {
          creditReplenishment: {
            expireUnused: draft.expireUnusedCredits,
            rollover: draft.rolloverCredits,
          },
        },
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    setMessage("Membership saved");
    await load();
  }

  async function createMembership() {
    const name = window.prompt("Membership name");
    if (!name?.trim()) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        priceCents: 9900,
        billingInterval: "month",
        benefits: { includedCredits: [{ quantity: 4, label: "Monthly credits" }] },
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

  async function enrollMember() {
    if (!selected || !sellContact) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        productId: selected.id,
        contactId: sellContact.id,
      }),
    });
    setSaving(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not enroll member");
      return;
    }
    setMessage(`Enrolled ${sellContact.name}`);
    setSellContact(null);
    await loadMembers(selected.id);
  }

  async function memberAction(subscriptionId: string, action: string) {
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, subscriptionId }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Action failed");
      return;
    }
    if (selected) await loadMembers(selected.id);
  }

  function toggleMemberOnlyType(typeId: string) {
    setDraft((d) => ({
      ...d,
      memberOnlyTypeIds: d.memberOnlyTypeIds.includes(typeId)
        ? d.memberOnlyTypeIds.filter((id) => id !== typeId)
        : [...d.memberOnlyTypeIds, typeId],
    }));
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading memberships…</p>;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 lg:flex-row">
      <div className="w-full lg:w-72 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Memberships</h1>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={() => void createMembership()}
          >
            Create
          </button>
        </div>
        {memberships.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No memberships yet. Create a plan to offer recurring benefits.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {memberships.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`w-full p-3 text-left text-sm ${selectedId === row.id ? "bg-muted" : ""}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="font-medium">{row.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatMoney(row.priceCents)}/{row.billingInterval}
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
          <p className="text-sm text-muted-foreground">Select a membership plan.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveMembership()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Billing</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span>Name</span>
                  <input
                    className="rounded border px-3 py-2"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
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
                <label className="flex flex-col gap-1 text-sm">
                  <span>Billing interval</span>
                  <select
                    className="rounded border px-3 py-2"
                    value={draft.billingInterval}
                    onChange={(e) => setDraft((d) => ({ ...d, billingInterval: e.target.value }))}
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
                />
                Active plan
              </label>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Recurring credits</h3>
              <label className="flex flex-col gap-1 text-sm max-w-xs">
                <span>Credits per billing cycle</span>
                <input
                  className="rounded border px-3 py-2"
                  type="number"
                  min={0}
                  value={draft.includedCredits[0]?.quantity ?? 0}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      includedCredits: [{ quantity: Number(e.target.value) || 0, label: "Monthly credits" }],
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.expireUnusedCredits}
                  onChange={(e) => setDraft((d) => ({ ...d, expireUnusedCredits: e.target.checked }))}
                />
                Unused credits expire each cycle
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.rolloverCredits}
                  onChange={(e) => setDraft((d) => ({ ...d, rolloverCredits: e.target.checked }))}
                />
                Allow rollover of unused credits
              </label>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Member-only booking access</h3>
              <p className="text-xs text-muted-foreground">
                Booking types selected here require an active membership with this plan.
              </p>
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {bookingTypes.map((type) => (
                  <li key={type.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.memberOnlyTypeIds.includes(type.id)}
                        onChange={() => toggleMemberOnlyType(type.id)}
                      />
                      {type.name}
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Failed payment & recovery</h3>
              <p className="text-sm text-muted-foreground">
                When a renewal payment fails, Transovo marks the subscription <strong>past due</strong> and
                suspends member-only access until payment is recovered. After successful payment, benefits restore
                automatically.
              </p>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Enroll member</h3>
              <ContactSearchField selected={sellContact} onSelect={setSellContact} />
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                disabled={!sellContact || saving}
                onClick={() => void enrollMember()}
              >
                Start membership
              </button>
            </section>

            <section className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Members</h3>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active members yet.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {members.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                      <div>
                        <Link href={`/contacts/${row.contactId}`} className="font-medium underline">
                          {contactLabel(row.contact)}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Since {new Date(row.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={row.status} />
                        {row.status === "past_due" ? (
                          <button
                            type="button"
                            className="text-xs underline"
                            onClick={() => void memberAction(row.id, "recover-payment")}
                          >
                            Mark recovered
                          </button>
                        ) : null}
                        {row.status === "active" ? (
                          <button
                            type="button"
                            className="text-xs underline"
                            onClick={() => void memberAction(row.id, "suspend-failed-payment")}
                          >
                            Simulate failed payment
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
