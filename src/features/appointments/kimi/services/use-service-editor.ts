"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildSavePayload,
  EMPTY_APPOINTMENT_TYPE_FORM,
  formStateFromApiType,
  type ApiAppointmentType,
} from "@/features/appointments/kimi/appointment-types/map-appointment-types";
import type { AppointmentTypeFormState } from "@/features/appointments/kimi/appointment-types/types";
import { defaultConfigForSegment, segmentById } from "@/lib/appointments/booking-types-segments";
import { defaultConfigPatchForKind } from "@/lib/appointments/booking-type-kind";
import { isServiceRow } from "@/lib/appointments/services/service-display";
import {
  newLocation,
  newStaffMember,
} from "@/features/appointments/kimi/shared/platform-settings-types";
import type {
  MembershipBenefits,
  PackageCreditRule,
  ServicePhaseKind,
} from "@/lib/appointments/service-booking/types";

export type StaffOption = {
  id: string;
  name: string;
  role?: string;
  active?: boolean;
  customerSelectable?: boolean;
};

export type LocationOption = {
  id: string;
  name: string;
  kind?: string;
  address?: string;
};

export type ResourceOption = {
  id: string;
  name: string;
  quantity: number;
  description?: string;
};

export type AddOnOption = {
  id: string;
  name: string;
  priceCents: number;
  durationDeltaMinutes: number;
  active: boolean;
  eligibleTypeIds: string[];
};

export type PackageOption = {
  id: string;
  name: string;
  priceCents: number;
  creditRules: PackageCreditRule[];
};

export type MembershipOption = {
  id: string;
  name: string;
  priceCents: number;
  billingInterval: string;
  benefits: MembershipBenefits;
};

export type PriceRuleOption = {
  id: string;
  name: string;
  ruleType: string;
  conditions: Record<string, unknown>;
  adjustmentType: string;
  adjustmentValue: number;
  active: boolean;
};

export type ServicePhase = {
  id: string;
  name: string;
  phaseKind: ServicePhaseKind;
  durationMinutes: number;
  staffRequired: boolean;
  resourceIds: string[];
  displayOrder: number;
};

export type ServiceEditorOptions = {
  staffOptions: StaffOption[];
  locationOptions: LocationOption[];
  connectedPaymentProviders: Array<{ provider: "stripe" | "square"; label: string }>;
  namedScheduleOptions: Array<{ id: string; name: string }>;
  resourceOptions: ResourceOption[];
  addOnOptions: AddOnOption[];
  categoryOptions: Array<{ id: string; name: string }>;
  intakeFormOptions: Array<{ id: string; name: string; active?: boolean; fieldCount: number }>;
  packageOptions: PackageOption[];
  membershipOptions: MembershipOption[];
  priceRuleOptions: PriceRuleOption[];
  /** Workspace-wide scheduling defaults a service inherits unless it overrides them. */
  workspaceDefaults: {
    startIntervalMinutes: number;
    minimumNoticeMinutes: number;
    maximumDaysAhead: number;
  };
};

const EMPTY_OPTIONS: ServiceEditorOptions = {
  staffOptions: [],
  locationOptions: [],
  connectedPaymentProviders: [],
  namedScheduleOptions: [],
  resourceOptions: [],
  addOnOptions: [],
  categoryOptions: [],
  intakeFormOptions: [],
  packageOptions: [],
  membershipOptions: [],
  priceRuleOptions: [],
  workspaceDefaults: { startIntervalMinutes: 0, minimumNoticeMinutes: 0, maximumDaysAhead: 0 },
};

type SettingsPlatform = {
  bookingEnabled?: boolean;
  staff?: Array<{ id: string; name: string; role?: string; active?: boolean; customerSelectable?: boolean }>;
  locations?: Array<{ id: string; name: string; kind?: string; address?: string; active?: boolean }>;
  namedSchedules?: Array<{ id: string; name: string }>;
  minimumBookingNoticeMinutes?: number;
  maximumBookingDaysAhead?: number;
  schedulingLimits?: { customStartIntervalMinutes?: number };
};

function draftStorageKey(serviceId: string | null): string {
  return `transovo:service-editor:${serviceId || "new"}`;
}

function readStoredDraft(serviceId: string | null): AppointmentTypeFormState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftStorageKey(serviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { form?: AppointmentTypeFormState };
    return parsed.form ?? null;
  } catch {
    return null;
  }
}

function writeStoredDraft(serviceId: string | null, form: AppointmentTypeFormState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      draftStorageKey(serviceId),
      JSON.stringify({ savedAt: Date.now(), form }),
    );
  } catch {
    // ignore quota errors
  }
}

function clearStoredDraft(serviceId: string | null): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftStorageKey(serviceId));
}

async function readJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  try {
    const json = (await res.json()) as { data?: T } | T;
    const data = (json as { data?: T }).data;
    return (data ?? (json as T)) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Credit rules on a package that grant this specific service. */
function packageGrantsService(pkg: PackageOption, serviceId: string): boolean {
  return (pkg.creditRules || []).some((r) => r.bookingTypeId === serviceId);
}

function membershipGrantsService(m: MembershipOption, serviceId: string): boolean {
  const benefits = m.benefits || {};
  if ((benefits.memberOnlyTypeIds || []).includes(serviceId)) return true;
  return (benefits.includedCredits || []).some((r) => r.bookingTypeId === serviceId);
}

export function useServiceEditor(
  serviceId: string | null,
  opts?: { creating?: boolean },
) {
  const router = useRouter();
  const isCreating = opts?.creating ?? !serviceId;

  const [form, setForm] = useState<AppointmentTypeFormState>(EMPTY_APPOINTMENT_TYPE_FORM);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [options, setOptions] = useState<ServiceEditorOptions>(EMPTY_OPTIONS);
  const [phases, setPhases] = useState<ServicePhase[]>([]);
  const draftRestoredRef = useRef(false);

  const initCreateForm = useCallback(() => {
    const segment = segmentById("services");
    const kindPatch = defaultConfigPatchForKind("SERVICE");
    const segmentPatch = defaultConfigForSegment(segment);
    const stored = readStoredDraft(null);
    if (stored && !draftRestoredRef.current) {
      draftRestoredRef.current = true;
      setForm({ ...stored, bookingTypeKind: "SERVICE" });
      return;
    }
    setForm({
      ...EMPTY_APPOINTMENT_TYPE_FORM,
      bookingTypeKind: "SERVICE",
      classPresentation: "recurring_class",
      ...kindPatch,
      ...segmentPatch,
    } as AppointmentTypeFormState);
  }, []);

  const loadOptions = useCallback(async () => {
    const [
      settingsRes,
      paymentsRes,
      resourcesRes,
      addOnsRes,
      categoriesRes,
      intakeRes,
      packagesRes,
      membershipsRes,
      priceRulesRes,
    ] = await Promise.all([
      fetch("/api/appointments/settings"),
      fetch("/api/merchant-payments/status"),
      fetch("/api/appointments/service-booking/resources"),
      fetch("/api/appointments/service-booking/add-ons"),
      fetch("/api/appointments/service-booking/categories"),
      fetch("/api/appointments/service-booking/intake-forms?targetKind=appointment"),
      fetch("/api/appointments/service-booking/packages"),
      fetch("/api/appointments/service-booking/memberships"),
      fetch("/api/appointments/service-booking/dynamic-pricing"),
    ]);
    if (!settingsRes.ok) throw new Error("settings failed");

    const settingsJson = (await settingsRes.json()) as {
      data?: SettingsPlatform;
      workspace?: { slug?: string };
    } & SettingsPlatform;
    const platform = settingsJson.data || settingsJson;
    const paymentsJson = paymentsRes.ok
      ? ((await paymentsRes.json()) as {
          data?: { connections?: Array<{ provider: string; canAcceptPayments?: boolean; connected?: boolean }> };
        })
      : { data: { connections: [] } };

    const providers = (paymentsJson.data?.connections || [])
      .filter((c) => c.canAcceptPayments || c.connected)
      .map((c) => ({
        provider: c.provider.toLowerCase() as "stripe" | "square",
        label: c.provider.toLowerCase() === "stripe" ? "Stripe" : "Square",
      }));

    const resources = await readJson<Array<Record<string, unknown>>>(resourcesRes, []);
    const addOns = await readJson<Array<Record<string, unknown>>>(addOnsRes, []);
    const categories = await readJson<Array<Record<string, unknown>>>(categoriesRes, []);
    const intake = await readJson<Array<Record<string, unknown>>>(intakeRes, []);
    const packages = await readJson<Array<Record<string, unknown>>>(packagesRes, []);
    const memberships = await readJson<Array<Record<string, unknown>>>(membershipsRes, []);
    const priceRules = await readJson<Array<Record<string, unknown>>>(priceRulesRes, []);

    const next: ServiceEditorOptions = {
      staffOptions: (platform.staff || [])
        .filter((s) => s.active !== false)
        .map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          active: s.active !== false,
          customerSelectable: s.customerSelectable,
        })),
      locationOptions: (platform.locations || [])
        .filter((l) => l.active !== false)
        .map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address })),
      connectedPaymentProviders: providers,
      namedScheduleOptions: (platform.namedSchedules || []).map((s) => ({ id: s.id, name: s.name })),
      resourceOptions: resources
        .filter((r) => r.active !== false)
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          quantity: Number(r.quantity ?? 1),
          description: r.description ? String(r.description) : undefined,
        })),
      addOnOptions: addOns.map((a) => ({
        id: String(a.id),
        name: String(a.name),
        priceCents: Number(a.priceCents ?? 0),
        durationDeltaMinutes: Number(a.durationDeltaMinutes ?? 0),
        active: a.active !== false,
        eligibleTypeIds: (a.eligibleTypeIds as string[]) || [],
      })),
      categoryOptions: categories
        .filter((c) => c.active !== false)
        .map((c) => ({ id: String(c.id), name: String(c.name) })),
      intakeFormOptions: intake.map((f) => ({
        id: String(f.id),
        name: String(f.name),
        active: f.active !== false,
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
      priceRuleOptions: priceRules.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        ruleType: String(r.ruleType),
        conditions: (r.conditions as Record<string, unknown>) || {},
        adjustmentType: String(r.adjustmentType),
        adjustmentValue: Number(r.adjustmentValue ?? 0),
        active: r.active !== false,
      })),
      workspaceDefaults: {
        startIntervalMinutes: platform.schedulingLimits?.customStartIntervalMinutes || 0,
        minimumNoticeMinutes: platform.minimumBookingNoticeMinutes || 0,
        maximumDaysAhead: platform.maximumBookingDaysAhead || 0,
      },
    };

    setWorkspaceSlug(settingsJson.workspace?.slug || "");
    setBookingEnabled(Boolean(platform.bookingEnabled));
    setOptions(next);
  }, []);

  const loadPhases = useCallback(async (id: string) => {
    const res = await fetch(
      `/api/appointments/service-booking/service-phases?appointmentTypeId=${encodeURIComponent(id)}`,
    );
    const rows = await readJson<Array<Record<string, unknown>>>(res, []);
    setPhases(
      rows
        .map((r) => ({
          id: String(r.id),
          name: String(r.name),
          phaseKind: String(r.phaseKind) as ServicePhaseKind,
          durationMinutes: Number(r.durationMinutes ?? 0),
          staffRequired: r.staffRequired !== false,
          resourceIds: (r.resourceIds as string[]) || [],
          displayOrder: Number(r.displayOrder ?? 0),
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const typesRes = await fetch("/api/appointments/types");
      if (!typesRes.ok) throw new Error("load failed");
      const typesJson = (await typesRes.json()) as { data?: ApiAppointmentType[] };
      await loadOptions();

      if (isCreating) {
        initCreateForm();
        setPhases([]);
      } else if (serviceId) {
        const row = (typesJson.data || []).find((t) => t.id === serviceId);
        if (!row || !isServiceRow(row)) throw new Error("not a service");
        await loadPhases(serviceId);
        const stored = readStoredDraft(serviceId);
        const loaded = formStateFromApiType(row);
        setSavedSnapshot(JSON.stringify(loaded));
        if (stored && !draftRestoredRef.current) {
          draftRestoredRef.current = true;
          setForm({ ...stored, bookingTypeKind: "SERVICE" });
          setSaveStatus(JSON.stringify(stored) === JSON.stringify(loaded) ? "saved" : "dirty");
        } else {
          setForm(loaded);
          setSaveStatus("saved");
        }
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [initCreateForm, isCreating, loadOptions, loadPhases, serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateForm = useCallback(
    <K extends keyof AppointmentTypeFormState>(key: K, value: AppointmentTypeFormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        writeStoredDraft(serviceId, next);
        setSaveStatus(JSON.stringify(next) !== savedSnapshot ? "dirty" : "saved");
        return next;
      });
      setError("");
    },
    [savedSnapshot, serviceId],
  );

  const persistDraft = useCallback(() => {
    writeStoredDraft(serviceId, form);
  }, [form, serviceId]);

  const bookingBaseUrl = useMemo(() => {
    if (!workspaceSlug || typeof window === "undefined") return null;
    return `${window.location.origin}/book/${encodeURIComponent(workspaceSlug)}`;
  }, [workspaceSlug]);

  const bookingLink = useMemo(() => {
    if (!bookingBaseUrl || !serviceId) return null;
    return `${bookingBaseUrl}/${encodeURIComponent(serviceId)}`;
  }, [bookingBaseUrl, serviceId]);

  const validate = useCallback((state: AppointmentTypeFormState): string => {
    if (!state.name.trim()) return "Service name is required";
    if (!Number.isFinite(state.durationMinutes) || state.durationMinutes < 5) {
      return "Duration must be at least 5 minutes";
    }
    if (state.paymentMode !== "none" && state.paymentPriceCents <= 0) {
      return "Set a price above $0 to collect payment";
    }
    if (state.paymentMode === "deposit") {
      if (state.paymentDepositCents <= 0) return "Set a deposit above $0";
      if (state.paymentDepositCents > state.paymentPriceCents) {
        return "Deposit cannot be more than the price";
      }
    }
    if (state.startTimeMode === "fixed" && state.fixedStartTimes.filter(Boolean).length === 0) {
      return "Add at least one fixed start time";
    }
    if (state.groupBookingEnabled && state.groupCapacity < 2) {
      return "Party size must be at least 2 when guests are allowed";
    }
    return "";
  }, []);

  const save = useCallback(async (): Promise<string | null> => {
    const message = validate(form);
    if (message) {
      setError(message);
      setSaveStatus("error");
      return null;
    }
    setSaving(true);
    setSaveStatus("saving");
    setError("");
    const payload = buildSavePayload({ ...form, bookingTypeKind: "SERVICE" });
    const res = await fetch(
      isCreating ? "/api/appointments/types" : `/api/appointments/types/${serviceId}`,
      {
        method: isCreating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}) as { error?: string });
      setError(json.error || "Could not save service");
      setSaving(false);
      setSaveStatus("error");
      return null;
    }
    const json = (await res.json()) as { data: ApiAppointmentType };
    const nextForm = formStateFromApiType(json.data);
    setSaving(false);
    setForm(nextForm);
    setSavedSnapshot(JSON.stringify(nextForm));
    setSaveStatus("saved");
    clearStoredDraft(serviceId);
    clearStoredDraft(json.data.id);
    if (isCreating) router.replace(`/appointments/services/${json.data.id}`);
    return json.data.id;
  }, [form, isCreating, router, serviceId, validate]);

  const duplicate = useCallback(async (): Promise<string | null> => {
    if (!serviceId) return null;
    const copy = { ...form, name: `${form.name.trim()} (copy)` };
    const message = validate(copy);
    if (message) {
      setError(message);
      setSaveStatus("error");
      return null;
    }
    setSaving(true);
    setError("");
    const payload = buildSavePayload({ ...copy, bookingTypeKind: "SERVICE" });
    const res = await fetch("/api/appointments/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setSaving(false);
      setError(json.error || "Could not duplicate service");
      setSaveStatus("error");
      return null;
    }
    const json = (await res.json()) as { data: ApiAppointmentType };
    // Phases belong to the type, not the config blob, so they are copied over
    // explicitly. Appointments are deliberately not cloned.
    for (const phase of phases) {
      await fetch("/api/appointments/service-booking/service-phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentTypeId: json.data.id,
          name: phase.name,
          phaseKind: phase.phaseKind,
          durationMinutes: phase.durationMinutes,
          staffRequired: phase.staffRequired,
          resourceIds: phase.resourceIds,
          displayOrder: phase.displayOrder,
        }),
      });
    }
    setSaving(false);
    router.push(`/appointments/services/${json.data.id}`);
    return json.data.id;
  }, [form, phases, router, serviceId, validate]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      updateForm("enabled", enabled);
      if (!serviceId) return;
      setSaving(true);
      const res = await fetch(`/api/appointments/types/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSavePayload({ ...form, enabled })),
      });
      setSaving(false);
      if (res.ok) {
        const json = (await res.json()) as { data: ApiAppointmentType };
        const nextForm = formStateFromApiType(json.data);
        setForm(nextForm);
        setSavedSnapshot(JSON.stringify(nextForm));
        setSaveStatus("saved");
      }
    },
    [form, serviceId, updateForm],
  );

  const copyBookingLink = useCallback(async () => {
    if (!bookingLink) return;
    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable in some embedded contexts; the URL stays visible.
    }
  }, [bookingLink]);

  const previewBooking = useCallback(() => {
    if (bookingLink) window.open(bookingLink, "_blank");
  }, [bookingLink]);

  // ---------------------------------------------------------------- phases

  const savePhase = useCallback(
    async (phase: Omit<ServicePhase, "id"> & { id?: string }) => {
      if (!serviceId) return;
      const res = await fetch("/api/appointments/service-booking/service-phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...phase, appointmentTypeId: serviceId }),
      });
      if (!res.ok) {
        setError("Could not save the service phase");
        return;
      }
      await loadPhases(serviceId);
    },
    [loadPhases, serviceId],
  );

  const deletePhase = useCallback(
    async (id: string) => {
      if (!serviceId) return;
      const res = await fetch(`/api/appointments/service-booking/service-phases/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Could not remove the service phase");
        return;
      }
      await loadPhases(serviceId);
    },
    [loadPhases, serviceId],
  );

  const movePhase = useCallback(
    async (id: string, direction: -1 | 1) => {
      if (!serviceId) return;
      const index = phases.findIndex((p) => p.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= phases.length) return;
      const reordered = [...phases];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      setPhases(reordered.map((p, i) => ({ ...p, displayOrder: i })));
      for (const [i, phase] of reordered.entries()) {
        await fetch("/api/appointments/service-booking/service-phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...phase, appointmentTypeId: serviceId, displayOrder: i }),
        });
      }
      await loadPhases(serviceId);
    },
    [loadPhases, phases, serviceId],
  );

  // ----------------------------------------------------- contextual create

  const addStaffMember = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const current = await fetch("/api/appointments/settings");
    if (!current.ok) return null;
    const currentJson = (await current.json()) as { data?: SettingsPlatform };
    const existing = currentJson.data?.staff || [];
    const member = { ...newStaffMember(), name: trimmed };
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff: [...existing, member] }),
    });
    if (!res.ok) return null;
    const saved = (await res.json()) as { data?: SettingsPlatform };
    const savedStaff = saved.data?.staff || [];
    const created = savedStaff.find((s) => s.name === trimmed) || member;
    setOptions((prev) => ({
      ...prev,
      staffOptions: savedStaff
        .filter((s) => s.active !== false)
        .map((s) => ({ id: s.id, name: s.name, role: s.role, active: true })),
    }));
    return created.id;
  }, []);

  const addLocation = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const current = await fetch("/api/appointments/settings");
    if (!current.ok) return null;
    const currentJson = (await current.json()) as { data?: SettingsPlatform };
    const existing = currentJson.data?.locations || [];
    const location = { ...newLocation(), name: trimmed };
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: [...existing, location] }),
    });
    if (!res.ok) return null;
    const saved = (await res.json()) as { data?: SettingsPlatform };
    const savedLocations = saved.data?.locations || [];
    const created = savedLocations.find((l) => l.name === trimmed) || location;
    setOptions((prev) => ({
      ...prev,
      locationOptions: savedLocations
        .filter((l) => l.active !== false)
        .map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address })),
    }));
    return created.id;
  }, []);

  const addCategory = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const res = await fetch("/api/appointments/service-booking/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: string; name: string } };
    const created = json.data;
    if (!created) return null;
    setOptions((prev) => ({
      ...prev,
      categoryOptions: [...prev.categoryOptions, { id: created.id, name: created.name }],
    }));
    return created.id;
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
      const created = json.data;
      if (!created) return null;
      setOptions((prev) => ({
        ...prev,
        resourceOptions: [
          ...prev.resourceOptions,
          { id: created.id, name: created.name, quantity: created.quantity ?? 1 },
        ],
      }));
      return created.id;
    },
    [],
  );

  const addAddOn = useCallback(
    async (input: { name: string; priceCents: number; durationDeltaMinutes: number }) => {
      const trimmed = input.name.trim();
      if (!trimmed) return null;
      const res = await fetch("/api/appointments/service-booking/add-ons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, name: trimmed }),
      });
      if (!res.ok) return null;
      await loadOptions();
      const json = (await res.json()) as { data?: { id: string } };
      return json.data?.id ?? null;
    },
    [loadOptions],
  );

  const addIntakeForm = useCallback(
    async (name: string): Promise<string | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const res = await fetch("/api/appointments/service-booking/intake-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, targetKind: "appointment", fields: [] }),
      });
      if (!res.ok) return null;
      await loadOptions();
      const json = (await res.json()) as { data?: { id: string } };
      return json.data?.id ?? null;
    },
    [loadOptions],
  );

  // -------------------------------------------------- entitlements & rules

  /**
   * Package and membership eligibility is stored on the entitlement product,
   * not on the service, so toggling here edits the canonical Package /
   * Membership record rather than duplicating the link on the service.
   */
  const togglePackage = useCallback(
    async (packageId: string, granted: boolean) => {
      if (!serviceId) return;
      const pkg = options.packageOptions.find((p) => p.id === packageId);
      if (!pkg) return;
      const rules = granted
        ? [...pkg.creditRules, { bookingTypeId: serviceId, quantity: 1, label: form.name }]
        : pkg.creditRules.filter((r) => r.bookingTypeId !== serviceId);
      const res = await fetch("/api/appointments/service-booking/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pkg.id, name: pkg.name, creditRules: rules }),
      });
      if (!res.ok) {
        setError("Could not update package eligibility");
        return;
      }
      setOptions((prev) => ({
        ...prev,
        packageOptions: prev.packageOptions.map((p) =>
          p.id === packageId ? { ...p, creditRules: rules } : p,
        ),
      }));
    },
    [form.name, options.packageOptions, serviceId],
  );

  const toggleMembership = useCallback(
    async (membershipId: string, granted: boolean) => {
      if (!serviceId) return;
      const membership = options.membershipOptions.find((m) => m.id === membershipId);
      if (!membership) return;
      const current = membership.benefits || {};
      const memberOnly = new Set(current.memberOnlyTypeIds || []);
      if (granted) memberOnly.add(serviceId);
      else memberOnly.delete(serviceId);
      const benefits: MembershipBenefits = {
        ...current,
        memberOnlyTypeIds: [...memberOnly],
      };
      const res = await fetch("/api/appointments/service-booking/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: membership.id,
          name: membership.name,
          priceCents: membership.priceCents,
          billingInterval: membership.billingInterval,
          benefits,
        }),
      });
      if (!res.ok) {
        setError("Could not update membership access");
        return;
      }
      setOptions((prev) => ({
        ...prev,
        membershipOptions: prev.membershipOptions.map((m) =>
          m.id === membershipId ? { ...m, benefits } : m,
        ),
      }));
    },
    [options.membershipOptions, serviceId],
  );

  const createMembershipQuick = useCallback(
    async (input: { name: string; priceCents: number; billingInterval: string }) => {
      if (!serviceId) {
        setError("Save the service before creating a membership");
        return null;
      }
      const benefits: MembershipBenefits = { memberOnlyTypeIds: [serviceId] };
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
    [serviceId],
  );

  const savePriceRule = useCallback(
    async (rule: {
      id?: string;
      name: string;
      ruleType: string;
      conditions: Record<string, unknown>;
      adjustmentType: "percent" | "fixed";
      adjustmentValue: number;
      active?: boolean;
    }) => {
      const res = await fetch("/api/appointments/service-booking/dynamic-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) {
        setError("Could not save the price rule");
        return;
      }
      await loadOptions();
    },
    [loadOptions],
  );

  const deactivatePriceRule = useCallback(
    async (rule: PriceRuleOption) => {
      await savePriceRule({ ...rule, adjustmentType: rule.adjustmentType as "percent" | "fixed", active: false });
    },
    [savePriceRule],
  );

  const eligiblePackageIds = useMemo(
    () =>
      serviceId
        ? options.packageOptions.filter((p) => packageGrantsService(p, serviceId)).map((p) => p.id)
        : [],
    [options.packageOptions, serviceId],
  );

  const eligibleMembershipIds = useMemo(
    () =>
      serviceId
        ? options.membershipOptions
            .filter((m) => membershipGrantsService(m, serviceId))
            .map((m) => m.id)
        : [],
    [options.membershipOptions, serviceId],
  );

  const servicePriceRules = useMemo(
    () =>
      serviceId
        ? options.priceRuleOptions.filter(
            (r) =>
              r.active &&
              (r.ruleType !== "appointment_type" ||
                ((r.conditions.appointmentTypeIds as string[]) || []).includes(serviceId)),
          )
        : [],
    [options.priceRuleOptions, serviceId],
  );

  return {
    form,
    updateForm,
    options,
    phases,
    loading,
    failed,
    saving,
    saveStatus,
    error,
    setError,
    isCreating,
    bookingEnabled,
    bookingLink,
    copied,
    serviceId,
    eligiblePackageIds,
    eligibleMembershipIds,
    servicePriceRules,
    load,
    save,
    validate,
    duplicate,
    setEnabled,
    copyBookingLink,
    previewBooking,
    persistDraft,
    savePhase,
    deletePhase,
    movePhase,
    addStaffMember,
    addLocation,
    addCategory,
    addResource,
    addAddOn,
    addIntakeForm,
    togglePackage,
    toggleMembership,
    createMembershipQuick,
    savePriceRule,
    deactivatePriceRule,
  };
}
