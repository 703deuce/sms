"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  classFormFromRow,
  classSavePayload,
  EMPTY_CLASS_FORM,
  validateClassForm,
  type ClassFormState,
  type ClassOccurrenceRow,
  type ClassSeriesRow,
} from "@/lib/appointments/classes/class-form";
import { resolveClassSeriesOfferingKind } from "@/lib/appointments/class-series-offering";
import type { MembershipBenefits, PackageCreditRule } from "@/lib/appointments/service-booking/types";
import {
  packageIncludesOffering,
  togglePackageForOffering,
} from "@/features/appointments/kimi/packages/use-package-editor";
import {
  membershipIncludesOffering,
  toggleMembershipForOffering,
} from "@/features/appointments/kimi/memberships/use-membership-editor";
import type { PlannedOccurrence } from "@/lib/appointments/classes/class-recurrence";
import {
  newLocation,
  newStaffMember,
} from "@/features/appointments/kimi/shared/platform-settings-types";

const API = "/api/appointments/service-booking/classes";

export type ClassRegistrant = {
  id: string;
  occurrenceId: string | null;
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  attendance: string | null;
  createdAt: string;
  access: string | null;
};

export type ClassWaitlistEntry = {
  id: string;
  position: number;
  contactId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: string;
  offerExpiresAt: string | null;
};

export type ClassEditorOptions = {
  staffOptions: Array<{ id: string; name: string; role?: string; avatarUrl?: string }>;
  locationOptions: Array<{ id: string; name: string; kind?: string; address?: string }>;
  resourceOptions: Array<{ id: string; name: string; quantity: number }>;
  intakeFormOptions: Array<{ id: string; name: string; fieldCount: number }>;
  packageOptions: Array<{ id: string; name: string; priceCents: number; creditRules: PackageCreditRule[] }>;
  membershipOptions: Array<{
    id: string;
    name: string;
    priceCents: number;
    billingInterval: string;
    benefits: MembershipBenefits;
  }>;
};

const EMPTY_OPTIONS: ClassEditorOptions = {
  staffOptions: [],
  locationOptions: [],
  resourceOptions: [],
  intakeFormOptions: [],
  packageOptions: [],
  membershipOptions: [],
};

const DRAFT_PREFIX = "transovo:class-draft:";

function draftKey(id: string | null) {
  return `${DRAFT_PREFIX}${id ?? "new"}`;
}

function readDraft(id: string | null): ClassFormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as ClassFormState) : null;
  } catch {
    return null;
  }
}

function writeDraft(id: string | null, form: ClassFormState) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(draftKey(id), JSON.stringify(form));
  } catch {
    /* storage full or blocked — the form still works, it just will not survive a reload */
  }
}

function clearDraft(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(draftKey(id));
  } catch {
    /* see writeDraft */
  }
}

async function readJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try {
    const json = (await res.json()) as { data?: T };
    return (json.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function post<T>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) return { error: json.error || "Request failed" };
  return { data: json.data };
}

/**
 * Everything the Class workspace reads and writes. The sections stay
 * presentational: they receive values and callbacks and never talk to the API
 * themselves, so there is exactly one place where a class is saved.
 */
export function useClassEditor(classId: string | null) {
  const router = useRouter();
  const isCreating = classId === null;

  const [form, setForm] = useState<ClassFormState>(EMPTY_CLASS_FORM);
  const [occurrences, setOccurrences] = useState<ClassOccurrenceRow[]>([]);
  const [registrants, setRegistrants] = useState<ClassRegistrant[]>([]);
  const [waitlist, setWaitlist] = useState<ClassWaitlistEntry[]>([]);
  const [options, setOptions] = useState<ClassEditorOptions>(EMPTY_OPTIONS);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const draftRestoredRef = useRef(false);

  const loadOptions = useCallback(async () => {
    const [settingsRes, resourcesRes, intakeRes, packagesRes, membershipsRes] = await Promise.all([
      fetch("/api/appointments/settings"),
      fetch("/api/appointments/service-booking/resources"),
      fetch("/api/appointments/service-booking/intake-forms"),
      fetch("/api/appointments/service-booking/packages"),
      fetch("/api/appointments/service-booking/memberships"),
    ]);

    const settingsJson = settingsRes.ok
      ? ((await settingsRes.json()) as {
          data?: {
            staff?: Array<{ id: string; name: string; role?: string; active?: boolean }>;
            locations?: Array<{
              id: string;
              name: string;
              kind?: string;
              address?: string;
              active?: boolean;
            }>;
          };
          workspace?: { slug?: string };
        })
      : {};
    const platform = settingsJson.data || {};

    const resources = await readJson<Array<Record<string, unknown>>>(resourcesRes, []);
    const intake = await readJson<Array<Record<string, unknown>>>(intakeRes, []);
    const packages = await readJson<Array<Record<string, unknown>>>(packagesRes, []);
    const memberships = await readJson<Array<Record<string, unknown>>>(membershipsRes, []);

    setWorkspaceSlug(settingsJson.workspace?.slug || "");
    setOptions({
      staffOptions: (platform.staff || [])
        .filter((s) => s.active !== false && s.name)
        .map((s) => ({ id: s.id, name: s.name, role: s.role })),
      locationOptions: (platform.locations || [])
        .filter((l) => l.active !== false && l.name)
        .map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address })),
      resourceOptions: resources
        .filter((r) => r.active !== false)
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          quantity: Number(r.quantity ?? 1),
        })),
      intakeFormOptions: intake.map((f) => ({
        id: String(f.id),
        name: String(f.name),
        fieldCount: Array.isArray(f.fields) ? f.fields.length : 0,
      })),
      packageOptions: packages
        .filter((p) => p.active !== false)
        .map((p) => ({
          id: String(p.id),
          name: String(p.name),
          priceCents: Number(p.priceCents ?? 0),
          creditRules: (p.creditRules as PackageCreditRule[]) || [],
        })),
      membershipOptions: memberships
        .filter((m) => m.active !== false)
        .map((m) => ({
          id: String(m.id),
          name: String(m.name),
          priceCents: Number(m.priceCents ?? 0),
          billingInterval: String(m.billingInterval || "month"),
          benefits: (m.benefits as MembershipBenefits) || {},
        })),
    });
  }, []);

  const loadOccurrences = useCallback(async (id: string) => {
    const { data } = await post<ClassOccurrenceRow[]>({ action: "list_occurrences", seriesId: id });
    setOccurrences(data || []);
  }, []);

  const loadRegistrants = useCallback(async (id: string) => {
    const { data } = await post<ClassRegistrant[]>({ action: "list_registrants", seriesId: id });
    setRegistrants(data || []);
  }, []);

  const loadWaitlist = useCallback(async (id: string) => {
    const { data } = await post<ClassWaitlistEntry[]>({ action: "list_waitlist", seriesId: id });
    setWaitlist(data || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      await loadOptions();
      if (isCreating) {
        const stored = readDraft(null);
        setForm(stored && !draftRestoredRef.current ? stored : EMPTY_CLASS_FORM);
        if (stored) draftRestoredRef.current = true;
        setOccurrences([]);
        setRegistrants([]);
        setWaitlist([]);
        setSavedSnapshot("");
        setSaveStatus("dirty");
      } else if (classId) {
        const res = await fetch(`${API}?seriesId=${encodeURIComponent(classId)}`);
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as { data?: ClassSeriesRow };
        const row = json.data;
        // The Classes route must never open a Workshop: they share a table and
        // are told apart only by metadata.
        if (!row || resolveClassSeriesOfferingKind(row.metadata) !== "class") {
          throw new Error("not a class");
        }
        const loaded = classFormFromRow(row);
        setOccurrences(row.occurrences || []);
        setSavedSnapshot(JSON.stringify(loaded));
        const stored = readDraft(classId);
        if (stored && !draftRestoredRef.current) {
          draftRestoredRef.current = true;
          setForm(stored);
          setSaveStatus(JSON.stringify(stored) === JSON.stringify(loaded) ? "saved" : "dirty");
        } else {
          setForm(loaded);
          setSaveStatus("saved");
        }
        await Promise.all([loadRegistrants(classId), loadWaitlist(classId)]);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [classId, isCreating, loadOptions, loadRegistrants, loadWaitlist]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback(
    <K extends keyof ClassFormState>(key: K, value: ClassFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        writeDraft(classId, next);
        setSaveStatus(JSON.stringify(next) !== savedSnapshot ? "dirty" : "saved");
        return next;
      });
      setError("");
    },
    [classId, savedSnapshot],
  );

  const bookingLink = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}/classes`;
  }, [workspaceSlug]);

  const save = useCallback(async (): Promise<string | null> => {
    const message = validateClassForm(form);
    if (message) {
      setError(message);
      setSaveStatus("error");
      return null;
    }
    setSaving(true);
    setSaveStatus("saving");
    setError("");
    const { data, error: err } = await post<ClassSeriesRow>(
      classSavePayload(form, classId ?? undefined),
    );
    if (!data) {
      setSaving(false);
      setError(err || "Could not save class");
      setSaveStatus("error");
      return null;
    }
    const next = classFormFromRow(data);
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
    setSaveStatus("saved");
    setSaving(false);
    clearDraft(classId);
    clearDraft(data.id);
    if (isCreating) router.replace(`/appointments/classes/${data.id}`);
    return data.id;
  }, [classId, form, isCreating, router]);

  const setActive = useCallback(
    async (active: boolean) => {
      if (!classId) return;
      setSaving(true);
      const { data, error: err } = await post<ClassSeriesRow>(
        classSavePayload({ ...form, active }, classId),
      );
      setSaving(false);
      if (!data) {
        setError(err || "Could not update class");
        return;
      }
      const next = classFormFromRow(data);
      setForm(next);
      setSavedSnapshot(JSON.stringify(next));
      setSaveStatus("saved");
    },
    [classId, form],
  );

  const duplicate = useCallback(async (): Promise<string | null> => {
    const copy = { ...form, name: `${form.name.trim()} (copy)` };
    setSaving(true);
    const { data, error: err } = await post<ClassSeriesRow>(classSavePayload(copy));
    setSaving(false);
    if (!data) {
      setError(err || "Could not duplicate class");
      return null;
    }
    router.push(`/appointments/classes/${data.id}`);
    return data.id;
  }, [form, router]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!classId) return false;
    setSaving(true);
    const { error: err } = await post({ action: "delete", seriesId: classId });
    setSaving(false);
    if (err) {
      setError(err);
      return false;
    }
    clearDraft(classId);
    router.push("/appointments/classes");
    return true;
  }, [classId, router]);

  // ------------------------------------------------------------- schedule

  const generateOccurrences = useCallback(
    async (planned: PlannedOccurrence[]): Promise<boolean> => {
      if (!classId || planned.length === 0) return false;
      const { error: err } = await post({
        action: "occurrences",
        seriesId: classId,
        occurrences: planned.map((o) => ({ ...o, capacity: form.capacity })),
      });
      if (err) {
        setError(err);
        return false;
      }
      await loadOccurrences(classId);
      return true;
    },
    [classId, form.capacity, loadOccurrences],
  );

  const cancelOccurrence = useCallback(
    async (occurrenceId: string) => {
      if (!classId) return;
      const { error: err } = await post({ action: "cancel_occurrence", occurrenceId });
      if (err) setError(err);
      await loadOccurrences(classId);
    },
    [classId, loadOccurrences],
  );

  const updateOccurrence = useCallback(
    async (occurrenceId: string, patch: { startsAt?: string; endsAt?: string; capacity?: number }) => {
      if (!classId) return;
      const { error: err } = await post({ action: "update_occurrence", occurrenceId, ...patch });
      if (err) setError(err);
      await loadOccurrences(classId);
    },
    [classId, loadOccurrences],
  );

  // -------------------------------------------------------- registrations

  const updateRegistration = useCallback(
    async (enrollmentId: string, patch: { status?: string; attendance?: string | null }) => {
      if (!classId) return;
      const { error: err } = await post({ action: "update_enrollment", enrollmentId, ...patch });
      if (err) setError(err);
      await Promise.all([loadRegistrants(classId), loadOccurrences(classId)]);
    },
    [classId, loadOccurrences, loadRegistrants],
  );

  const promoteFromWaitlist = useCallback(
    async (entryId: string, occurrenceId: string): Promise<boolean> => {
      if (!classId) return false;
      const { error: err } = await post({ action: "promote_waitlist", entryId, occurrenceId });
      if (err) {
        setError(err);
        return false;
      }
      await Promise.all([loadWaitlist(classId), loadRegistrants(classId), loadOccurrences(classId)]);
      return true;
    },
    [classId, loadOccurrences, loadRegistrants, loadWaitlist],
  );

  const removeFromWaitlist = useCallback(
    async (entryId: string) => {
      if (!classId) return;
      const { error: err } = await post({ action: "remove_waitlist", entryId });
      if (err) setError(err);
      await loadWaitlist(classId);
    },
    [classId, loadWaitlist],
  );

  // ---------------------------------------------------- contextual create

  /**
   * Staff and locations live in workspace settings, so adding one from inside
   * the class editor reads the current list, appends and writes it back. The
   * class draft is untouched, which is the whole point of doing it here.
   */
  const addStaffMember = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const current = await fetch("/api/appointments/settings");
    if (!current.ok) return null;
    const json = (await current.json()) as {
      data?: { staff?: Array<{ id: string; name: string; active?: boolean }> };
    };
    const existing = json.data?.staff || [];
    const member = { ...newStaffMember(), name: trimmed };
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff: [...existing, member] }),
    });
    if (!res.ok) return null;
    const saved = (await res.json()) as {
      data?: { staff?: Array<{ id: string; name: string; role?: string; active?: boolean }> };
    };
    const list = saved.data?.staff || [];
    setOptions((prev) => ({
      ...prev,
      staffOptions: list
        .filter((s) => s.active !== false && s.name)
        .map((s) => ({ id: s.id, name: s.name, role: s.role })),
    }));
    return (list.find((s) => s.name === trimmed) || member).id;
  }, []);

  const addLocation = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const current = await fetch("/api/appointments/settings");
    if (!current.ok) return null;
    const json = (await current.json()) as {
      data?: { locations?: Array<{ id: string; name: string; active?: boolean }> };
    };
    const existing = json.data?.locations || [];
    const location = { ...newLocation(), name: trimmed };
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: [...existing, location] }),
    });
    if (!res.ok) return null;
    const saved = (await res.json()) as {
      data?: {
        locations?: Array<{
          id: string;
          name: string;
          kind?: string;
          address?: string;
          active?: boolean;
        }>;
      };
    };
    const list = saved.data?.locations || [];
    setOptions((prev) => ({
      ...prev,
      locationOptions: list
        .filter((l) => l.active !== false && l.name)
        .map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address })),
    }));
    return (list.find((l) => l.name === trimmed) || location).id;
  }, []);

  const addResource = useCallback(
    async (name: string, quantity: number): Promise<string | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const res = await fetch("/api/appointments/service-booking/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, quantity: Math.max(1, quantity) }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: { id: string; name: string; quantity: number } };
      if (!json.data) return null;
      setOptions((prev) => ({
        ...prev,
        resourceOptions: [
          ...prev.resourceOptions,
          { id: json.data!.id, name: json.data!.name, quantity: json.data!.quantity ?? 1 },
        ],
      }));
      return json.data.id;
    },
    [],
  );

  const addIntakeForm = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const res = await fetch("/api/appointments/service-booking/intake-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, fields: [] }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string; name: string } };
    if (!json.data) return null;
    setOptions((prev) => ({
      ...prev,
      intakeFormOptions: [
        ...prev.intakeFormOptions,
        { id: json.data!.id, name: json.data!.name, fieldCount: 0 },
      ],
    }));
    return json.data.id;
  }, []);

  const copyBookingLink = useCallback(async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link");
    }
  }, [bookingLink]);

  const previewBooking = useCallback(() => {
    if (bookingLink) window.open(bookingLink, "_blank", "noopener");
  }, [bookingLink]);

  const eligiblePackageIds = useMemo(() => {
    if (!classId) return [];
    return options.packageOptions
      .filter((pkg) =>
        packageIncludesOffering(pkg.creditRules, { kind: "class", id: classId }),
      )
      .map((pkg) => pkg.id);
  }, [classId, options.packageOptions]);

  const togglePackage = useCallback(
    async (packageId: string, granted: boolean) => {
      if (!classId) return;
      const pkg = options.packageOptions.find((p) => p.id === packageId);
      if (!pkg) return;
      try {
        const rules = await togglePackageForOffering({
          packageId: pkg.id,
          packageName: pkg.name,
          packageRules: pkg.creditRules,
          offering: { id: classId, name: form.name, kind: "class", meta: "Class" },
          granted,
        });
        setOptions((prev) => ({
          ...prev,
          packageOptions: prev.packageOptions.map((p) =>
            p.id === packageId ? { ...p, creditRules: rules } : p,
          ),
        }));
      } catch {
        setError("Could not update package eligibility");
      }
    },
    [classId, form.name, options.packageOptions],
  );

  const eligibleMembershipIds = useMemo(() => {
    if (!classId) return [];
    return options.membershipOptions
      .filter((m) =>
        membershipIncludesOffering(m.benefits, { kind: "class", id: classId }),
      )
      .map((m) => m.id);
  }, [classId, options.membershipOptions]);

  const toggleMembership = useCallback(
    async (membershipId: string, granted: boolean) => {
      if (!classId) return;
      const membership = options.membershipOptions.find((m) => m.id === membershipId);
      if (!membership) return;
      try {
        const benefits = await toggleMembershipForOffering({
          membershipId: membership.id,
          membershipName: membership.name,
          priceCents: membership.priceCents,
          billingInterval: membership.billingInterval,
          benefits: membership.benefits,
          offering: { id: classId, name: form.name, kind: "class", meta: "Class" },
          granted,
        });
        setOptions((prev) => ({
          ...prev,
          membershipOptions: prev.membershipOptions.map((m) =>
            m.id === membershipId ? { ...m, benefits } : m,
          ),
        }));
      } catch {
        setError("Could not update membership access");
      }
    },
    [classId, form.name, options.membershipOptions],
  );

  const createMembershipQuick = useCallback(
    async (input: { name: string; priceCents: number; billingInterval: string }) => {
      if (!classId) {
        setError("Save the class before creating a membership");
        return null;
      }
      const benefits: MembershipBenefits = { memberOnlyClassSeriesIds: [classId] };
      const res = await fetch("/api/appointments/service-booking/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name.trim(),
          priceCents: input.priceCents,
          billingInterval: input.billingInterval,
          benefits,
          active: true,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: {
          id: string;
          name: string;
          priceCents: number;
          billingInterval: string;
          benefits: MembershipBenefits;
        };
        error?: string;
      };
      if (!res.ok || !json.data) {
        setError(json.error || "Could not create membership");
        return null;
      }
      const row = json.data;
      setOptions((prev) => ({
        ...prev,
        membershipOptions: [
          ...prev.membershipOptions,
          {
            id: row.id,
            name: row.name,
            priceCents: row.priceCents,
            billingInterval: row.billingInterval,
            benefits: row.benefits,
          },
        ],
      }));
      return row.id;
    },
    [classId],
  );

  return {
    classId,
    isCreating,
    form,
    occurrences,
    registrants,
    waitlist,
    options,
    loading,
    failed,
    saving,
    error,
    setError,
    copied,
    saveStatus,
    bookingLink,
    updateForm,
    save,
    setActive,
    duplicate,
    remove,
    reload: load,
    generateOccurrences,
    cancelOccurrence,
    updateOccurrence,
    updateRegistration,
    promoteFromWaitlist,
    removeFromWaitlist,
    addStaffMember,
    addLocation,
    addResource,
    addIntakeForm,
    copyBookingLink,
    previewBooking,
    eligiblePackageIds,
    togglePackage,
    eligibleMembershipIds,
    toggleMembership,
    createMembershipQuick,
  };
}
