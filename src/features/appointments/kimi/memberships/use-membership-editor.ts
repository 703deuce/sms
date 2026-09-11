"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildMembershipBenefits,
  EMPTY_MEMBERSHIP_FORM,
  membershipFormFromRowWithOfferings,
  membershipGrantsOffering,
  membershipSavePayload,
  type MembershipFormState,
  type MembershipProductApiRow,
  validateMembershipForm,
} from "@/lib/appointments/memberships/membership-form";
import type { MembershipBenefits } from "@/lib/appointments/service-booking/types";
import { isServiceRow } from "@/lib/appointments/services/service-display";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { resolveClassSeriesOfferingKind } from "@/lib/appointments/class-series-offering";

const API = "/api/appointments/service-booking/memberships";

export type MembershipSubscriptionView = {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  status: string;
  startedAt: string;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  amountCents: number;
  cancelAtPeriodEnd: boolean;
};

export type MembershipActivityView = {
  id: string;
  contactId: string;
  contactName: string;
  event: string;
  billingCents: number | null;
  reference: string | null;
  status: string;
  createdAt: string;
};

export type OfferingOption = {
  id: string;
  name: string;
  kind: "service" | "meeting" | "class" | "workshop";
  meta: string;
};

export type MembershipEditorOptions = {
  offerings: OfferingOption[];
  workspaceSlug: string;
};

const EMPTY_OPTIONS: MembershipEditorOptions = { offerings: [], workspaceSlug: "" };

async function readJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try {
    const json = (await res.json()) as { data?: T };
    return (json.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function useMembershipEditor(membershipId: string | null) {
  const router = useRouter();
  const isCreating = membershipId === null;

  const [form, setForm] = useState<MembershipFormState>(EMPTY_MEMBERSHIP_FORM);
  const [slug, setSlug] = useState("");
  const [options, setOptions] = useState<MembershipEditorOptions>(EMPTY_OPTIONS);
  const [subscriptions, setSubscriptions] = useState<MembershipSubscriptionView[]>([]);
  const [activity, setActivity] = useState<MembershipActivityView[]>([]);
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

  const offeringKindMap = useMemo(() => {
    const map = new Map<string, "service" | "meeting" | "class" | "workshop">();
    for (const o of options.offerings) map.set(o.id, o.kind);
    return map;
  }, [options.offerings]);

  const loadMembership = useCallback(async () => {
    if (!membershipId) return;
    setLoading(true);
    setFailed(false);
    try {
      const [productRes, subsRes, activityRes] = await Promise.all([
        fetch(`${API}?productId=${membershipId}`),
        fetch(`${API}?productId=${membershipId}&view=subscriptions`),
        fetch(`${API}?productId=${membershipId}&view=activity`),
      ]);
      if (!productRes.ok) throw new Error("not found");
      const row = await readJson<MembershipProductApiRow>(productRes, null as never);
      const nextForm = membershipFormFromRowWithOfferings(row, offeringKindMap);
      setForm(nextForm);
      setSlug(row.slug);
      setSavedSnapshot(JSON.stringify(nextForm));
      setSaveStatus("saved");
      setSubscriptions(await readJson(subsRes, []));
      setActivity(await readJson(activityRes, []));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [membershipId, offeringKindMap]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (membershipId && options.offerings.length) void loadMembership();
  }, [membershipId, loadMembership, options.offerings.length]);

  const snapshot = useMemo(() => JSON.stringify(form), [form]);
  const dirty = snapshot !== savedSnapshot;

  useEffect(() => {
    if (loading) return;
    if (saveStatus === "saving") return;
    setSaveStatus(dirty ? "dirty" : "saved");
  }, [dirty, loading, saveStatus]);

  const onFormChange = useCallback(<K extends keyof MembershipFormState>(key: K, value: MembershipFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const validation = validateMembershipForm(form);
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
        body: JSON.stringify(membershipSavePayload(form, membershipId || undefined)),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: MembershipProductApiRow; error?: string };
      if (!res.ok) throw new Error(json.error || "Save failed");
      const row = json.data!;
      const nextForm = membershipFormFromRowWithOfferings(row, offeringKindMap);
      setForm(nextForm);
      setSlug(row.slug);
      setSavedSnapshot(JSON.stringify(nextForm));
      setSaveStatus("saved");
      if (!membershipId && row.id) {
        router.replace(`/appointments/memberships/${row.id}?created=1`);
      } else {
        void loadMembership();
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveStatus("error");
      return false;
    } finally {
      setSaving(false);
    }
  }, [form, loadMembership, membershipId, offeringKindMap, router]);

  const toggleOffering = useCallback((offering: OfferingOption, included: boolean) => {
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
  }, []);

  const duplicateMembership = useCallback(async () => {
    if (!membershipId) return;
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", productId: membershipId }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: { id: string } };
    if (json.data?.id) router.push(`/appointments/memberships/${json.data.id}`);
  }, [membershipId, router]);

  const deactivateMembership = useCallback(async () => {
    onFormChange("active", false);
    await save();
  }, [onFormChange, save]);

  const deleteMembership = useCallback(async () => {
    if (!membershipId) return;
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", productId: membershipId }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error || "Could not delete membership");
      return;
    }
    router.push("/appointments/memberships");
  }, [membershipId, router]);

  const subscriptionAction = useCallback(
    async (subscriptionId: string, action: string, extra?: Record<string, unknown>) => {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, subscriptionId, ...extra }),
      });
      if (!res.ok) {
        setError("Membership action failed");
        return false;
      }
      await loadMembership();
      return true;
    },
    [loadMembership],
  );

  const benefits = useMemo(() => buildMembershipBenefits(form), [form]);

  const eligibleOfferings = useMemo(
    () => options.offerings.filter((offering) => membershipGrantsOffering(benefits, offering)),
    [benefits, options.offerings],
  );

  const memberStats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active").length;
    const pastDue = subscriptions.filter((s) => s.status === "past_due").length;
    const cancelling = subscriptions.filter((s) => s.status === "cancelling").length;
    const cancelled = subscriptions.filter((s) => s.status === "canceled").length;
    const paused = subscriptions.filter((s) => s.status === "paused").length;
    return { active, pastDue, cancelling, cancelled, paused, total: subscriptions.length };
  }, [subscriptions]);

  return {
    form,
    slug,
    options,
    subscriptions,
    activity,
    memberStats,
    eligibleOfferings,
    benefits,
    loading,
    failed,
    saving,
    error,
    saveStatus,
    dirty,
    onFormChange,
    save,
    toggleOffering,
    duplicateMembership,
    deactivateMembership,
    deleteMembership,
    subscriptionAction,
    reload: loadMembership,
  };
}

/** Toggle membership eligibility from a bookable-object editor (canonical benefits). */
export async function toggleMembershipForOffering(input: {
  membershipId: string;
  membershipName: string;
  priceCents: number;
  billingInterval: string;
  benefits: MembershipBenefits;
  offering: OfferingOption;
  granted: boolean;
}): Promise<MembershipBenefits> {
  const benefits = { ...input.benefits };
  const typeIds = new Set(benefits.memberOnlyTypeIds || []);
  const classIds = new Set(benefits.memberOnlyClassSeriesIds || []);

  if (input.offering.kind === "service" || input.offering.kind === "meeting") {
    if (input.granted) typeIds.add(input.offering.id);
    else typeIds.delete(input.offering.id);
  } else {
    if (input.granted) classIds.add(input.offering.id);
    else classIds.delete(input.offering.id);
  }

  const next: MembershipBenefits = {
    ...benefits,
    memberOnlyTypeIds: [...typeIds],
    memberOnlyClassSeriesIds: [...classIds],
  };

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.membershipId,
      name: input.membershipName,
      priceCents: input.priceCents,
      billingInterval: input.billingInterval,
      benefits: next,
    }),
  });
  if (!res.ok) throw new Error("Could not update membership eligibility");
  return next;
}

export function membershipIncludesOffering(
  benefits: MembershipBenefits,
  offering: { kind: "service" | "meeting" | "class" | "workshop"; id: string },
): boolean {
  return membershipGrantsOffering(benefits, offering);
}
