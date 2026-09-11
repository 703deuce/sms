"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PricingSectionId } from "@/components/appointments/pricing-payments/pricing-section-types";
import type { AppointmentPlatformConfig, AppointmentTypeConfig, CommerceDefaults } from "@/lib/appointments/types";
import {
  buildOfferingRows,
  defaultCollectionSummary,
} from "@/lib/appointments/pricing-payments/pricing-workspace";
import type { MerchantConnectionView } from "@/lib/merchant-payments/types";

const VALID = new Set<string>([
  "overview",
  "collection",
  "deposits",
  "packages",
  "discounts",
  "refunds",
  "providers",
  "checkout",
]);

type TypeRow = {
  id: string;
  name: string;
  durationMinutes?: number;
  config?: AppointmentTypeConfig | null;
  active?: boolean;
};

export function usePricingPaymentsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const section: PricingSectionId =
    sectionParam && VALID.has(sectionParam) ? (sectionParam as PricingSectionId) : "overview";

  const setSection = useCallback(
    (next: PricingSectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("section");
      else params.set("section", next);
      const q = params.toString();
      router.replace(`/appointments/pricing-payments${q ? `?${q}` : ""}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [platform, setPlatform] = useState<AppointmentPlatformConfig | null>(null);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [connections, setConnections] = useState<MerchantConnectionView[]>([]);
  const [packageCount, setPackageCount] = useState(0);
  const [membershipCount, setMembershipCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [packageLinks, setPackageLinks] = useState<Map<string, number>>(new Map());
  const [membershipLinks, setMembershipLinks] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [previewOfferingId, setPreviewOfferingId] = useState<string>("");

  const commerceDefaults = platform?.commerceDefaults;

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [settingsRes, typesRes, merchantRes, packagesRes, membershipsRes, couponsRes] =
        await Promise.all([
          fetch("/api/appointments/settings"),
          fetch("/api/appointments/types"),
          fetch("/api/merchant-payments/status"),
          fetch("/api/appointments/service-booking/packages").catch(() => null),
          fetch("/api/appointments/service-booking/memberships").catch(() => null),
          fetch("/api/appointments/service-booking/coupons").catch(() => null),
        ]);
      if (!settingsRes.ok) throw new Error("settings");
      const settingsJson = await settingsRes.json();
      setPlatform(settingsJson.data as AppointmentPlatformConfig);

      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      const rows = (typesJson.data || []) as TypeRow[];
      setTypes(rows);
      setPreviewOfferingId((prev) => prev || rows[0]?.id || "");

      if (merchantRes?.ok) {
        const m = await merchantRes.json();
        setConnections((m.data?.connections || []) as MerchantConnectionView[]);
      }

      if (packagesRes?.ok) {
        const p = await packagesRes.json();
        const list = (p.data || []) as Array<{ id: string; active?: boolean; creditRules?: Array<{ bookingTypeId?: string }> }>;
        setPackageCount(list.filter((x) => x.active !== false).length);
        const map = new Map<string, number>();
        for (const pkg of list) {
          for (const rule of pkg.creditRules || []) {
            if (!rule.bookingTypeId) continue;
            map.set(rule.bookingTypeId, (map.get(rule.bookingTypeId) || 0) + 1);
          }
        }
        setPackageLinks(map);
      }

      if (membershipsRes?.ok) {
        const m = await membershipsRes.json();
        const list = (m.data || []) as Array<{ id: string; active?: boolean; benefits?: { memberOnlyTypeIds?: string[] } }>;
        setMembershipCount(list.filter((x) => x.active !== false).length);
        const map = new Map<string, number>();
        for (const mem of list) {
          for (const typeId of mem.benefits?.memberOnlyTypeIds || []) {
            map.set(typeId, (map.get(typeId) || 0) + 1);
          }
        }
        setMembershipLinks(map);
      }

      if (couponsRes?.ok) {
        const c = await couponsRes.json();
        const list = (c.data || []) as Array<{ active?: boolean }>;
        setCouponCount(list.filter((x) => x.active !== false).length);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const providerReady = useMemo(
    () => connections.some((c) => c.canAcceptPayments),
    [connections],
  );

  const offeringRows = useMemo(
    () =>
      buildOfferingRows(types, commerceDefaults, packageLinks, membershipLinks, providerReady),
    [commerceDefaults, membershipLinks, packageLinks, providerReady, types],
  );

  const patchDefaults = useCallback((patch: Partial<CommerceDefaults>) => {
    setPlatform((prev) =>
      prev
        ? {
            ...prev,
            commerceDefaults: { ...(prev.commerceDefaults || {}), ...patch },
          }
        : prev,
    );
    setSaved(false);
  }, []);

  const saveSettings = useCallback(async () => {
    if (!platform) return false;
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commerceDefaults: platform.commerceDefaults }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError((json as { error?: string }).error || "Could not save");
      return false;
    }
    setSaved(true);
    return true;
  }, [platform]);

  const updateOfferingPayment = useCallback(
    async (typeId: string, payment: AppointmentTypeConfig["payment"] | null) => {
      const row = types.find((t) => t.id === typeId);
      if (!row) return false;
      const base = { ...(row.config || {}) } as AppointmentTypeConfig;
      const config =
        payment === null
          ? (() => {
              const { payment: _removed, ...rest } = base;
              return rest as AppointmentTypeConfig;
            })()
          : { ...base, payment };
      const res = await fetch(`/api/appointments/types/${typeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) return false;
      setTypes((prev) =>
        prev.map((t) => (t.id === typeId ? { ...t, config } : t)),
      );
      return true;
    },
    [types],
  );

  const stats = useMemo(() => {
    const stripe = connections.find((c) => c.provider === "STRIPE");
    const square = connections.find((c) => c.provider === "SQUARE");
    return {
      defaultSummary: defaultCollectionSummary(commerceDefaults, offeringRows),
      offeringsTotal: offeringRows.length,
      offeringsCustom: offeringRows.filter((r) => !r.usesDefault).length,
      offeringsIssues: offeringRows.filter((r) => r.status !== "ready").length,
      packageCount,
      membershipCount,
      couponCount,
      taxesConfigured: false,
      stripeConnected: Boolean(stripe?.canAcceptPayments),
      squareConnected: Boolean(square?.canAcceptPayments),
      stripeStatus: stripe?.status || "not_connected",
    };
  }, [commerceDefaults, connections, couponCount, membershipCount, offeringRows, packageCount]);

  const attention = useMemo(() => {
    const flags = new Set<PricingSectionId>();
    if (!providerReady && offeringRows.some((r) => r.collectionMode !== "none")) {
      flags.add("providers");
    }
    if (stats.offeringsIssues > 0) flags.add("collection");
    return flags;
  }, [offeringRows, providerReady, stats.offeringsIssues]);

  const previewOffering = offeringRows.find((r) => r.id === previewOfferingId) || offeringRows[0];

  return {
    section,
    setSection,
    platform,
    commerceDefaults,
    types,
    offeringRows,
    connections,
    stats,
    attention,
    previewOffering,
    previewOfferingId,
    setPreviewOfferingId,
    loading,
    failed,
    saving,
    saved,
    error,
    load,
    patchDefaults,
    saveSettings,
    updateOfferingPayment,
    providerReady,
  };
}
