"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EMPTY_WORKSHOP_FORM,
  validateWorkshopForm,
  workshopFormFromRow,
  workshopSavePayload,
  type WorkshopFormState,
  type WorkshopSeriesRow,
} from "@/lib/appointments/workshops/workshop-form";
import {
  sessionDraftToRange,
  type WorkshopSessionDraft,
  type WorkshopSessionRow,
} from "@/lib/appointments/workshops/workshop-schedule";
import {
  newLocation,
  newStaffMember,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import type { MembershipBenefits, PackageCreditRule } from "@/lib/appointments/service-booking/types";
import {
  packageIncludesOffering,
  togglePackageForOffering,
} from "@/features/appointments/kimi/packages/use-package-editor";
import {
  membershipIncludesOffering,
  toggleMembershipForOffering,
} from "@/features/appointments/kimi/memberships/use-membership-editor";

const API = "/api/appointments/service-booking/workshops";

export type WorkshopRegistrant = {
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

export type WorkshopWaitlistEntry = {
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

export type WorkshopEditorOptions = {
  staffOptions: Array<{ id: string; name: string; role?: string }>;
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

const EMPTY_OPTIONS: WorkshopEditorOptions = {
  staffOptions: [],
  locationOptions: [],
  resourceOptions: [],
  intakeFormOptions: [],
  packageOptions: [],
  membershipOptions: [],
};

const DRAFT_PREFIX = "transovo:workshop-draft:";

function draftKey(id: string | null) {
  return `${DRAFT_PREFIX}${id ?? "new"}`;
}

function readDraft(id: string | null): WorkshopFormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(draftKey(id));
    return raw ? (JSON.parse(raw) as WorkshopFormState) : null;
  } catch {
    return null;
  }
}

function writeDraft(id: string | null, form: WorkshopFormState) {
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
 * Everything the Workshop workspace reads and writes. Sections stay
 * presentational — they receive values and callbacks and never call the API
 * themselves, so there is one place a workshop is saved.
 */
export function useWorkshopEditor(workshopId: string | null) {
  const router = useRouter();
  const isCreating = workshopId === null;

  const [form, setForm] = useState<WorkshopFormState>(EMPTY_WORKSHOP_FORM);
  const [sessions, setSessions] = useState<WorkshopSessionRow[]>([]);
  const [registrants, setRegistrants] = useState<WorkshopRegistrant[]>([]);
  const [waitlist, setWaitlist] = useState<WorkshopWaitlistEntry[]>([]);
  const [options, setOptions] = useState<WorkshopEditorOptions>(EMPTY_OPTIONS);
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

  const loadSessions = useCallback(async (id: string) => {
    const { data } = await post<WorkshopSessionRow[]>({ action: "list_occurrences", seriesId: id });
    setSessions(data || []);
  }, []);

  const loadRegistrants = useCallback(async (id: string) => {
    const { data } = await post<WorkshopRegistrant[]>({ action: "list_registrants", seriesId: id });
    setRegistrants(data || []);
  }, []);

  const loadWaitlist = useCallback(async (id: string) => {
    const { data } = await post<WorkshopWaitlistEntry[]>({ action: "list_waitlist", seriesId: id });
    setWaitlist(data || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      await loadOptions();
      if (isCreating) {
        const stored = readDraft(null);
        setForm(stored && !draftRestoredRef.current ? stored : EMPTY_WORKSHOP_FORM);
        if (stored) draftRestoredRef.current = true;
        setSessions([]);
        setRegistrants([]);
        setWaitlist([]);
        setSavedSnapshot("");
        setSaveStatus("dirty");
      } else if (workshopId) {
        // The route enforces the kind, so a class id returns 404 here rather
        // than opening somebody else's class in the Workshops editor.
        const res = await fetch(`${API}?seriesId=${encodeURIComponent(workshopId)}`);
        if (!res.ok) throw new Error("load failed");
        const json = (await res.json()) as { data?: WorkshopSeriesRow };
        const row = json.data;
        if (!row) throw new Error("not a workshop");
        const loaded = workshopFormFromRow(row);
        setSessions(row.occurrences || []);
        setSavedSnapshot(JSON.stringify(loaded));
        const stored = readDraft(workshopId);
        if (stored && !draftRestoredRef.current) {
          draftRestoredRef.current = true;
          setForm(stored);
          setSaveStatus(JSON.stringify(stored) === JSON.stringify(loaded) ? "saved" : "dirty");
        } else {
          setForm(loaded);
          setSaveStatus("saved");
        }
        await Promise.all([loadRegistrants(workshopId), loadWaitlist(workshopId)]);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [isCreating, loadOptions, loadRegistrants, loadWaitlist, workshopId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback(
    <K extends keyof WorkshopFormState>(key: K, value: WorkshopFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        writeDraft(workshopId, next);
        setSaveStatus(JSON.stringify(next) !== savedSnapshot ? "dirty" : "saved");
        return next;
      });
      setError("");
    },
    [savedSnapshot, workshopId],
  );

  const bookingLink = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}/workshops`;
  }, [workspaceSlug]);

  const persist = useCallback(
    async (next: WorkshopFormState): Promise<WorkshopSeriesRow | null> => {
      const message = validateWorkshopForm(next);
      if (message) {
        setError(message);
        setSaveStatus("error");
        return null;
      }
      setSaving(true);
      setSaveStatus("saving");
      setError("");
      const { data, error: err } = await post<WorkshopSeriesRow>(
        workshopSavePayload(next, workshopId ?? undefined),
      );
      setSaving(false);
      if (!data) {
        setError(err || "Could not save workshop");
        setSaveStatus("error");
        return null;
      }
      const applied = workshopFormFromRow({ ...data, occurrences: sessions });
      setForm(applied);
      setSavedSnapshot(JSON.stringify(applied));
      setSaveStatus("saved");
      clearDraft(workshopId);
      clearDraft(data.id);
      return data;
    },
    [sessions, workshopId],
  );

  const save = useCallback(async (): Promise<string | null> => {
    const data = await persist(form);
    if (!data) return null;
    if (isCreating) router.replace(`/appointments/workshops/${data.id}`);
    return data.id;
  }, [form, isCreating, persist, router]);

  const setActive = useCallback(
    async (active: boolean) => {
      await persist({ ...form, active });
    },
    [form, persist],
  );

  /**
   * Calling a workshop off is not the same as deactivating it: registration
   * stops and the page says so, but the registrations stay on the record.
   */
  const cancelWorkshop = useCallback(async (): Promise<boolean> => {
    const data = await persist({
      ...form,
      cancelledAt: new Date().toISOString(),
      active: false,
    });
    return Boolean(data);
  }, [form, persist]);

  const reopenWorkshop = useCallback(async (): Promise<boolean> => {
    const data = await persist({ ...form, cancelledAt: "", active: true });
    return Boolean(data);
  }, [form, persist]);

  /**
   * A copy is the configuration only. Registrations, payments and attendance
   * belong to the event that happened, and the date is cleared because a
   * duplicate on the same day is almost never what was meant.
   */
  const duplicate = useCallback(async (): Promise<string | null> => {
    const copy: WorkshopFormState = {
      ...form,
      name: `${form.name.trim()} (copy)`,
      cancelledAt: "",
      schedule: { ...form.schedule, date: "" },
    };
    setSaving(true);
    const { data, error: err } = await post<WorkshopSeriesRow>(workshopSavePayload(copy));
    setSaving(false);
    if (!data) {
      setError(err || "Could not duplicate workshop");
      return null;
    }
    router.push(`/appointments/workshops/${data.id}`);
    return data.id;
  }, [form, router]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!workshopId) return false;
    setSaving(true);
    const { error: err } = await post({ action: "delete", seriesId: workshopId });
    setSaving(false);
    if (err) {
      setError(err);
      return false;
    }
    clearDraft(workshopId);
    router.push("/appointments/workshops");
    return true;
  }, [router, workshopId]);

  // -------------------------------------------------------------- sessions

  const addSession = useCallback(
    async (draft: WorkshopSessionDraft): Promise<boolean> => {
      if (!workshopId) return false;
      const range = sessionDraftToRange(draft);
      if (!range) {
        setError("Pick a date and a start time for the session");
        return false;
      }
      const { error: err } = await post({
        action: "occurrences",
        seriesId: workshopId,
        occurrences: [{ ...range, capacity: form.capacity }],
      });
      if (err) {
        setError(err);
        return false;
      }
      await loadSessions(workshopId);
      return true;
    },
    [form.capacity, loadSessions, workshopId],
  );

  const updateSession = useCallback(
    async (sessionId: string, draft: WorkshopSessionDraft): Promise<boolean> => {
      if (!workshopId) return false;
      const range = sessionDraftToRange(draft);
      if (!range) {
        setError("Pick a date and a start time for the session");
        return false;
      }
      const { error: err } = await post({
        action: "update_occurrence",
        occurrenceId: sessionId,
        ...range,
      });
      if (err) {
        setError(err);
        return false;
      }
      await loadSessions(workshopId);
      return true;
    },
    [loadSessions, workshopId],
  );

  const cancelSession = useCallback(
    async (sessionId: string) => {
      if (!workshopId) return;
      const { error: err } = await post({ action: "cancel_occurrence", occurrenceId: sessionId });
      if (err) setError(err);
      await loadSessions(workshopId);
    },
    [loadSessions, workshopId],
  );

  const setSessionCapacity = useCallback(
    async (sessionId: string, capacity: number) => {
      if (!workshopId) return;
      const { error: err } = await post({
        action: "update_occurrence",
        occurrenceId: sessionId,
        capacity,
      });
      if (err) setError(err);
      await loadSessions(workshopId);
    },
    [loadSessions, workshopId],
  );

  // --------------------------------------------------------- registrations

  const updateRegistration = useCallback(
    async (enrollmentId: string, patch: { status?: string; attendance?: string | null }) => {
      if (!workshopId) return;
      const { error: err } = await post({ action: "update_enrollment", enrollmentId, ...patch });
      if (err) setError(err);
      await Promise.all([loadRegistrants(workshopId), loadSessions(workshopId)]);
    },
    [loadRegistrants, loadSessions, workshopId],
  );

  /** Attendance is the only check-in runtime there is, so this writes it. */
  const setCheckedIn = useCallback(
    async (enrollmentId: string, checkedIn: boolean) => {
      await updateRegistration(enrollmentId, { attendance: checkedIn ? "attended" : null });
    },
    [updateRegistration],
  );

  const promoteFromWaitlist = useCallback(
    async (entryId: string, occurrenceId: string): Promise<boolean> => {
      if (!workshopId) return false;
      const { error: err } = await post({ action: "promote_waitlist", entryId, occurrenceId });
      if (err) {
        setError(err);
        return false;
      }
      await Promise.all([
        loadWaitlist(workshopId),
        loadRegistrants(workshopId),
        loadSessions(workshopId),
      ]);
      return true;
    },
    [loadRegistrants, loadSessions, loadWaitlist, workshopId],
  );

  const removeFromWaitlist = useCallback(
    async (entryId: string) => {
      if (!workshopId) return;
      const { error: err } = await post({ action: "remove_waitlist", entryId });
      if (err) setError(err);
      await loadWaitlist(workshopId);
    },
    [loadWaitlist, workshopId],
  );

  // ----------------------------------------------------- contextual create

  /**
   * Hosts and locations live in workspace settings, so adding one from inside
   * the workshop editor reads the current list, appends and writes it back.
   * The workshop draft is untouched, which is the whole point of doing it here.
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
    if (!workshopId) return [];
    return options.packageOptions
      .filter((pkg) =>
        packageIncludesOffering(pkg.creditRules, { kind: "workshop", id: workshopId }),
      )
      .map((pkg) => pkg.id);
  }, [options.packageOptions, workshopId]);

  const togglePackage = useCallback(
    async (packageId: string, granted: boolean) => {
      if (!workshopId) return;
      const pkg = options.packageOptions.find((p) => p.id === packageId);
      if (!pkg) return;
      try {
        const rules = await togglePackageForOffering({
          packageId: pkg.id,
          packageName: pkg.name,
          packageRules: pkg.creditRules,
          offering: { id: workshopId, name: form.name, kind: "workshop", meta: "Workshop" },
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
    [form.name, options.packageOptions, workshopId],
  );

  const eligibleMembershipIds = useMemo(() => {
    if (!workshopId) return [];
    return options.membershipOptions
      .filter((m) =>
        membershipIncludesOffering(m.benefits, { kind: "workshop", id: workshopId }),
      )
      .map((m) => m.id);
  }, [options.membershipOptions, workshopId]);

  const toggleMembership = useCallback(
    async (membershipId: string, granted: boolean) => {
      if (!workshopId) return;
      const membership = options.membershipOptions.find((m) => m.id === membershipId);
      if (!membership) return;
      try {
        const benefits = await toggleMembershipForOffering({
          membershipId: membership.id,
          membershipName: membership.name,
          priceCents: membership.priceCents,
          billingInterval: membership.billingInterval,
          benefits: membership.benefits,
          offering: { id: workshopId, name: form.name, kind: "workshop", meta: "Workshop" },
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
    [form.name, options.membershipOptions, workshopId],
  );

  return {
    workshopId,
    isCreating,
    form,
    sessions,
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
    cancelWorkshop,
    reopenWorkshop,
    duplicate,
    remove,
    reload: load,
    addSession,
    updateSession,
    cancelSession,
    setSessionCapacity,
    updateRegistration,
    setCheckedIn,
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
  };
}

export type WorkshopEditor = ReturnType<typeof useWorkshopEditor>;
