"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PackageCreditRule, PackageLifecyclePolicy } from "@/lib/appointments/service-booking/types";
import { readPackageLifecyclePolicyClient } from "@/lib/appointments/packages/package-display";

export type PackageFormState = {
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
  expirationDays: number | null;
  creditRules: PackageCreditRule[];
  lifecyclePolicy: PackageLifecyclePolicy;
};

export type PackageBalanceRow = {
  id: string;
  contactId: string;
  status: string;
  expiresAt?: string | null;
  creditsRemaining: number;
  contact: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

const DEFAULT_FORM: PackageFormState = {
  name: "",
  description: "",
  priceCents: 0,
  active: true,
  expirationDays: 180,
  creditRules: [{ quantity: 10, label: "Sessions" }],
  lifecyclePolicy: {
    restoreCreditsOnCancel: true,
    restoreCreditsOnLateCancel: false,
    restoreCreditsOnNoShow: false,
  },
};

function draftKey(id: string | null) {
  return `transovo:package-editor:${id || "new"}`;
}

export function usePackageEditor(packageId: string | null) {
  const router = useRouter();
  const isCreating = !packageId;
  const [form, setForm] = useState<PackageFormState>(DEFAULT_FORM);
  const [slug, setSlug] = useState("");
  const [balances, setBalances] = useState<PackageBalanceRow[]>([]);
  const [bookingTypeOptions, setBookingTypeOptions] = useState<Array<{ id: string; name: string; kind: string }>>([]);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const draftRestored = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
      ]);
      if (typesRes.ok) {
        const typesJson = await typesRes.json();
        const rows = (typesJson.data || []) as Array<{ id: string; name: string; config?: { bookingTypeKind?: string } }>;
        setBookingTypeOptions(
          rows
            .filter((r) => {
              const kind = r.config?.bookingTypeKind;
              return kind === "SERVICE" || kind === "CLASS" || kind === "MEETING";
            })
            .map((r) => ({
              id: r.id,
              name: r.name,
              kind: r.config?.bookingTypeKind || "SERVICE",
            })),
        );
      }
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
      }

      if (isCreating) {
        const stored = sessionStorage.getItem(draftKey(null));
        if (stored && !draftRestored.current) {
          draftRestored.current = true;
          setForm(JSON.parse(stored) as PackageFormState);
        }
      } else {
        const res = await fetch(`/api/appointments/service-booking/packages/${packageId}`);
        if (!res.ok) throw new Error("not found");
        const json = await res.json();
        const data = json.data || json;
        const product = data.product;
        const stored = sessionStorage.getItem(draftKey(packageId));
        if (stored && !draftRestored.current) {
          draftRestored.current = true;
          setForm(JSON.parse(stored) as PackageFormState);
        } else {
          setForm({
            name: product.name,
            description: product.description || "",
            priceCents: product.priceCents || 0,
            active: product.active !== false,
            expirationDays: product.expirationDays ?? null,
            creditRules: (product.creditRules || []) as PackageCreditRule[],
            lifecyclePolicy:
              data.lifecyclePolicy ||
              readPackageLifecyclePolicyClient(product.metadata as Record<string, unknown>),
          });
        }
        setSlug(product.slug);
        setBalances((data.balances || []) as PackageBalanceRow[]);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [isCreating, packageId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistDraft = useCallback(() => {
    sessionStorage.setItem(draftKey(packageId), JSON.stringify(form));
  }, [form, packageId]);

  const updateForm = useCallback(
    <K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        sessionStorage.setItem(draftKey(packageId), JSON.stringify(next));
        return next;
      });
      setError("");
    },
    [packageId],
  );

  const save = useCallback(async (): Promise<string | null> => {
    if (!form.name.trim()) {
      setError("Package name is required");
      return null;
    }
    setSaving(true);
    setError("");
    const payload = {
      id: packageId || undefined,
      name: form.name.trim(),
      description: form.description,
      priceCents: form.priceCents,
      active: form.active,
      expirationDays: form.expirationDays,
      creditRules: form.creditRules,
      metadata: { lifecyclePolicy: form.lifecyclePolicy },
    };
    const res = await fetch("/api/appointments/service-booking/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save package");
      setSaving(false);
      return null;
    }
    const json = await res.json();
    const saved = json.data || json;
    sessionStorage.removeItem(draftKey(packageId));
    sessionStorage.removeItem(draftKey(null));
    setSaving(false);
    if (isCreating) {
      router.replace(`/appointments/packages/${saved.id}`);
    } else {
      await load();
    }
    return saved.id as string;
  }, [form, isCreating, load, packageId, router]);

  const assignPackage = useCallback(
    async (contactId: string) => {
      if (!packageId) return false;
      const res = await fetch("/api/appointments/service-booking/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purchase", productId: packageId, contactId }),
      });
      if (!res.ok) return false;
      await load();
      return true;
    },
    [load, packageId],
  );

  const adjustCredits = useCallback(
    async (balanceId: string, amount: number, reason: string, note: string) => {
      const balance = balances.find((b) => b.id === balanceId);
      if (!balance) return false;
      const key = Object.keys((balance as { remainingCredits?: Record<string, number> }).remainingCredits || {})[0] || "default";
      const delta = { [key]: amount };
      const res = await fetch("/api/appointments/service-booking/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_credits",
          balanceId,
          delta,
          note: `${reason}${note ? `: ${note}` : ""}`,
        }),
      });
      if (!res.ok) return false;
      await load();
      return true;
    },
    [balances, load],
  );

  const storeLink = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}/store`;
  }, [workspaceSlug]);

  const copyStoreLink = useCallback(async () => {
    if (!storeLink) return;
    try {
      await navigator.clipboard.writeText(storeLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [storeLink]);

  const duplicate = useCallback(async () => {
    if (!packageId) return;
    setSaving(true);
    const res = await fetch("/api/appointments/service-booking/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${form.name.trim()} (copy)`,
        description: form.description,
        priceCents: form.priceCents,
        creditRules: form.creditRules,
        expirationDays: form.expirationDays,
        metadata: { lifecyclePolicy: form.lifecyclePolicy },
      }),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      const saved = json.data || json;
      router.push(`/appointments/packages/${saved.id}`);
    }
  }, [form, packageId, router]);

  return {
    form,
    updateForm,
    slug,
    balances,
    bookingTypeOptions,
    loading,
    failed,
    saving,
    error,
    isCreating,
    storeLink,
    copied,
    persistDraft,
    save,
    assignPackage,
    adjustCredits,
    copyStoreLink,
    duplicate,
    reload: load,
  };
}
