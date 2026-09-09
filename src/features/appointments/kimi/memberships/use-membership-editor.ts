"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MembershipBenefits, PackageCreditRule } from "@/lib/appointments/service-booking/types";

export type MembershipFormState = {
  name: string;
  description: string;
  priceCents: number;
  billingInterval: string;
  active: boolean;
  benefits: MembershipBenefits;
  rolloverEnabled: boolean;
  rolloverCap: number | null;
};

export type MembershipSubscriptionRow = {
  id: string;
  contactId: string;
  status: string;
  currentPeriodEnd?: string | null;
  contact: { id: string; firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null } | null;
};

const DEFAULT: MembershipFormState = {
  name: "",
  description: "",
  priceCents: 9900,
  billingInterval: "month",
  active: true,
  benefits: { includedCredits: [{ quantity: 4, label: "Sessions per month" }] },
  rolloverEnabled: false,
  rolloverCap: null,
};

function draftKey(id: string | null) {
  return `transovo:membership-editor:${id || "new"}`;
}

export function useMembershipEditor(membershipId: string | null) {
  const router = useRouter();
  const isCreating = !membershipId;
  const [form, setForm] = useState<MembershipFormState>(DEFAULT);
  const [subscriptions, setSubscriptions] = useState<MembershipSubscriptionRow[]>([]);
  const [bookingTypeOptions, setBookingTypeOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [paymentsConnected, setPaymentsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const draftRestored = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, paymentsRes] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/merchant-payments/status"),
      ]);
      if (typesRes.ok) {
        const typesJson = await typesRes.json();
        setBookingTypeOptions(
          ((typesJson.data || []) as Array<{ id: string; name: string }>).map((r) => ({ id: r.id, name: r.name })),
        );
      }
      if (paymentsRes.ok) {
        const paymentsJson = await paymentsRes.json();
        setPaymentsConnected(
          (paymentsJson.data?.connections || []).some((c: { canAcceptPayments?: boolean }) => c.canAcceptPayments),
        );
      }

      if (isCreating) {
        const stored = sessionStorage.getItem(draftKey(null));
        if (stored && !draftRestored.current) {
          draftRestored.current = true;
          setForm(JSON.parse(stored) as MembershipFormState);
        }
      } else {
        const res = await fetch(`/api/appointments/service-booking/memberships/${membershipId}`);
        if (!res.ok) throw new Error("not found");
        const json = await res.json();
        const data = json.data || json;
        const product = data.product;
        const meta = (product.metadata || {}) as { rolloverEnabled?: boolean; rolloverCap?: number };
        const stored = sessionStorage.getItem(draftKey(membershipId));
        if (stored && !draftRestored.current) {
          draftRestored.current = true;
          setForm(JSON.parse(stored) as MembershipFormState);
        } else {
          setForm({
            name: product.name,
            description: product.description || "",
            priceCents: product.priceCents,
            billingInterval: product.billingInterval,
            active: product.active !== false,
            benefits: (product.benefits || {}) as MembershipBenefits,
            rolloverEnabled: Boolean(meta.rolloverEnabled),
            rolloverCap: meta.rolloverCap ?? null,
          });
        }
        setSubscriptions((data.subscriptions || []) as MembershipSubscriptionRow[]);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [isCreating, membershipId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback(
    <K extends keyof MembershipFormState>(key: K, value: MembershipFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        sessionStorage.setItem(draftKey(membershipId), JSON.stringify(next));
        return next;
      });
      setError("");
    },
    [membershipId],
  );

  const save = useCallback(async () => {
    if (!form.name.trim()) {
      setError("Membership name is required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: membershipId || undefined,
        name: form.name.trim(),
        description: form.description,
        priceCents: form.priceCents,
        billingInterval: form.billingInterval,
        active: form.active,
        benefits: form.benefits,
        metadata: { rolloverEnabled: form.rolloverEnabled, rolloverCap: form.rolloverCap },
      }),
    });
    if (!res.ok) {
      setError("Could not save membership");
      setSaving(false);
      return;
    }
    const json = await res.json();
    const saved = json.data || json;
    sessionStorage.removeItem(draftKey(membershipId));
    setSaving(false);
    if (isCreating) router.replace(`/appointments/memberships/${saved.id}`);
    else await load();
  }, [form, isCreating, load, membershipId, router]);

  const subscribeMember = useCallback(
    async (contactId: string) => {
      if (!membershipId) return false;
      const res = await fetch("/api/appointments/service-booking/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", productId: membershipId, contactId }),
      });
      if (!res.ok) return false;
      await load();
      return true;
    },
    [load, membershipId],
  );

  const subscriptionAction = useCallback(
    async (action: string, subscriptionId: string, mode?: string) => {
      if (!membershipId) return false;
      const res = await fetch(`/api/appointments/service-booking/memberships/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subscriptionId, mode }),
      });
      if (!res.ok) return false;
      await load();
      return true;
    },
    [load, membershipId],
  );

  const updateBenefitCredits = (credits: PackageCreditRule[]) => {
    updateForm("benefits", { ...form.benefits, includedCredits: credits });
  };

  const toggleMemberOnly = (typeId: string) => {
    const ids = form.benefits.memberOnlyTypeIds || [];
    const next = ids.includes(typeId) ? ids.filter((id) => id !== typeId) : [...ids, typeId];
    updateForm("benefits", { ...form.benefits, memberOnlyTypeIds: next });
  };

  return {
    form,
    updateForm,
    subscriptions,
    bookingTypeOptions,
    paymentsConnected,
    loading,
    failed,
    saving,
    error,
    isCreating,
    save,
    subscribeMember,
    subscriptionAction,
    updateBenefitCredits,
    toggleMemberOnly,
    persistDraft: () => sessionStorage.setItem(draftKey(membershipId), JSON.stringify(form)),
  };
}
