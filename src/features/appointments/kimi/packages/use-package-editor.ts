"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildCreditRules,
  EMPTY_PACKAGE_FORM,
  packageFormFromRow,
  packageGrantsOffering,
  packageSavePayload,
  type PackageFormState,
  type PackageProductApiRow,
  validatePackageForm,
} from "@/lib/appointments/packages/package-form";
import type { PackageCreditRule } from "@/lib/appointments/service-booking/types";
import { isServiceRow } from "@/lib/appointments/services/service-display";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { resolveClassSeriesOfferingKind } from "@/lib/appointments/class-series-offering";

const API = "/api/appointments/service-booking/packages";

export type PackageBalanceView = {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  status: string;
  totalRemaining: number;
  expiresAt: string | null;
  createdAt: string;
};

export type PackageActivityView = {
  id: string;
  balanceId: string;
  kind: string;
  contactName: string;
  note: string | null;
  appointmentId: string | null;
  createdAt: string;
  balanceAfter: number | null;
};

export type OfferingOption = {
  id: string;
  name: string;
  kind: "service" | "meeting" | "class" | "workshop";
  meta: string;
};

export type PackageEditorOptions = {
  offerings: OfferingOption[];
  workspaceSlug: string;
};

const EMPTY_OPTIONS: PackageEditorOptions = { offerings: [], workspaceSlug: "" };

async function readJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try {
    const json = (await res.json()) as { data?: T };
    return (json.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function usePackageEditor(packageId: string | null) {
  const router = useRouter();
  const isCreating = packageId === null;

  const [form, setForm] = useState<PackageFormState>(EMPTY_PACKAGE_FORM);
  const [slug, setSlug] = useState("");
  const [options, setOptions] = useState<PackageEditorOptions>(EMPTY_OPTIONS);
  const [balances, setBalances] = useState<PackageBalanceView[]>([]);
  const [activity, setActivity] = useState<PackageActivityView[]>([]);
  const [loading, setLoading] = useState(!isCreating);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");

  const loadOptions = useCallback(async () => {
    const [typesRes, classesRes, workshopsRes, settingsRes] = await Promise.all([
      fetch("/api/appointments/types"),
      fetch("/api/appointments/service-booking/classes"),
      fetch("/api/appointments/service-booking/workshops"),
      fetch("/api/appointments/settings"),
    ]);

    const typesJson = typesRes.ok ? ((await typesRes.json()) as { data?: Array<Record<string, unknown>> }) : {};
    const classes = await readJson<Array<Record<string, unknown>>>(classesRes, []);
    const workshops = await readJson<Array<Record<string, unknown>>>(workshopsRes, []);
    const settingsJson = settingsRes.ok
      ? ((await settingsRes.json()) as { workspace?: { slug?: string } })
      : {};

    const offerings: OfferingOption[] = [];
    for (const row of (typesJson.data || []) as Array<Record<string, unknown>>) {
      const kind = resolveBookingTypeKind((row.config as AppointmentTypeConfig | null) || null);
      if (kind === "MEETING") {
        offerings.push({
          id: String(row.id),
          name: String(row.name),
          kind: "meeting",
          meta: String(row.durationMinutes ?? "") ? `${row.durationMinutes} min` : "Meeting",
        });
        continue;
      }
      if (!isServiceRow(row as never)) continue;
      offerings.push({
        id: String(row.id),
        name: String(row.name),
        kind: "service",
        meta: String(row.durationMinutes ?? "") ? `${row.durationMinutes} min` : "Service",
      });
    }
    for (const row of classes) {
      if (resolveClassSeriesOfferingKind(row.metadata) !== "class") continue;
      offerings.push({
        id: String(row.id),
        name: String(row.name),
        kind: "class",
        meta: "Class",
      });
    }
    for (const row of workshops) {
      offerings.push({
        id: String(row.id),
        name: String(row.name),
        kind: "workshop",
        meta: "Workshop",
      });
    }

    setOptions({ offerings, workspaceSlug: settingsJson.workspace?.slug || "" });
  }, []);

  const loadPackage = useCallback(async () => {
    if (!packageId) return;
    setLoading(true);
    setFailed(false);
    try {
      const [pkgRes, balancesRes, activityRes] = await Promise.all([
        fetch(`${API}?productId=${packageId}`),
        fetch(`${API}?productId=${packageId}&view=balances`),
        fetch(`${API}?productId=${packageId}&view=activity`),
      ]);
      if (!pkgRes.ok) throw new Error("not found");
      const row = await readJson<PackageProductApiRow>(pkgRes, null as never);
      const nextForm = packageFormFromRow(row);
      setForm(nextForm);
      setSlug(row.slug);
      setSavedSnapshot(JSON.stringify(nextForm));
      setSaveStatus("saved");
      setBalances(await readJson(balancesRes, []));
      setActivity(await readJson(activityRes, []));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (packageId) void loadPackage();
  }, [packageId, loadPackage]);

  const snapshot = useMemo(() => JSON.stringify(form), [form]);
  const dirty = snapshot !== savedSnapshot;

  useEffect(() => {
    if (loading) return;
    if (saveStatus === "saving") return;
    setSaveStatus(dirty ? "dirty" : "saved");
  }, [dirty, loading, saveStatus]);

  const onFormChange = useCallback(<K extends keyof PackageFormState>(key: K, value: PackageFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const validation = validatePackageForm(form);
    if (validation) {
      setError(validation);
      setSaveStatus("error");
      return false;
    }
    setSaving(true);
    setSaveStatus("saving");
    setError("");
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packageSavePayload(form, packageId || undefined)),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: PackageProductApiRow; error?: string };
      if (!res.ok) throw new Error(json.error || "Save failed");
      const row = json.data!;
      const nextForm = packageFormFromRow(row);
      setForm(nextForm);
      setSlug(row.slug);
      setSavedSnapshot(JSON.stringify(nextForm));
      setSaveStatus("saved");
      if (!packageId && row.id) {
        router.replace(`/appointments/packages/${row.id}?created=1`);
      } else {
        void loadPackage();
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveStatus("error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, loadPackage, packageId, router]);

  const toggleOffering = useCallback(
    (offering: OfferingOption, included: boolean) => {
      const key =
        offering.kind === "service"
          ? "eligibleServiceIds"
          : offering.kind === "meeting"
            ? "eligibleMeetingIds"
            : offering.kind === "workshop"
              ? "eligibleWorkshopIds"
              : "eligibleClassIds";
      setForm((prev) => {
        const current = prev[key];
        const next = included
          ? current.filter((id) => id !== offering.id)
          : [...current, offering.id];
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  const duplicatePackage = useCallback(async () => {
    if (!packageId) return;
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", productId: packageId }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { id: string } };
    if (json.data?.id) router.push(`/appointments/packages/${json.data.id}`);
  }, [packageId, router]);

  const deactivatePackage = useCallback(async () => {
    onFormChange("active", false);
    await save();
  }, [onFormChange, save]);

  const deletePackage = useCallback(async () => {
    if (!packageId) return;
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", productId: packageId }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not delete package");
      return;
    }
    router.push("/appointments/packages");
  }, [packageId, router]);

  const adjustCredits = useCallback(
    async (balanceId: string, delta: number, note: string) => {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_credits",
          balanceId,
          delta: { default: delta },
          note,
        }),
      });
      if (!res.ok) {
        setError("Could not adjust credits");
        return false;
      }
      await loadPackage();
      return true;
    },
    [loadPackage],
  );

  const creditRules = useMemo(() => buildCreditRules(form), [form]);

  const eligibleOfferings = useMemo(
    () =>
      options.offerings.filter((offering) =>
        packageGrantsOffering(creditRules, offering),
      ),
    [creditRules, options.offerings],
  );

  const ownerStats = useMemo(() => {
    const active = balances.filter((b) => b.status === "active").length;
    const depleted = balances.filter((b) => b.status === "exhausted").length;
    const expired = balances.filter((b) => b.status === "expired").length;
    const remaining = balances.reduce((sum, b) => sum + b.totalRemaining, 0);
    return { active, depleted, expired, remaining, total: balances.length };
  }, [balances]);

  return {
    form,
    slug,
    options,
    balances,
    activity,
    ownerStats,
    eligibleOfferings,
    creditRules,
    loading,
    failed,
    saving,
    error,
    saveStatus,
    dirty,
    onFormChange,
    save,
    toggleOffering,
    duplicatePackage,
    deactivatePackage,
    deletePackage,
    adjustCredits,
    reload: loadPackage,
  };
}

/** Toggle package eligibility from a bookable-object editor (canonical creditRules). */
export async function togglePackageForOffering(input: {
  packageId: string;
  packageName: string;
  packageRules: PackageCreditRule[];
  offering: OfferingOption;
  granted: boolean;
}): Promise<PackageCreditRule[]> {
  const rules = [...input.packageRules];
  const without = rules.filter((rule) => {
    if (input.offering.kind === "service") {
      return !(rule.bookingTypeId === input.offering.id && rule.label !== "Meeting");
    }
    if (input.offering.kind === "meeting") {
      return !(rule.bookingTypeId === input.offering.id && rule.label === "Meeting");
    }
    return !(
      rule.classSeriesId === input.offering.id &&
      rule.label === (input.offering.kind === "workshop" ? "Workshop" : "Class")
    );
  });
  const next =
    input.granted
      ? [
          ...without,
          input.offering.kind === "service"
            ? { bookingTypeId: input.offering.id, quantity: 0, label: "Service" }
            : input.offering.kind === "meeting"
              ? { bookingTypeId: input.offering.id, quantity: 0, label: "Meeting" }
              : {
                  classSeriesId: input.offering.id,
                  quantity: 0,
                  label: input.offering.kind === "workshop" ? "Workshop" : "Class",
                },
        ]
      : without;
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: input.packageId, name: input.packageName, creditRules: next }),
  });
  if (!res.ok) throw new Error("Could not update package eligibility");
  return next;
}

export function packageIncludesOffering(
  rules: PackageCreditRule[],
  offering: { kind: "service" | "meeting" | "class" | "workshop"; id: string },
): boolean {
  return packageGrantsOffering(rules, offering);
}
