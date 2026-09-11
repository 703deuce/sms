"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Briefcase,
  CalendarCheck,
  ChevronDown,
  MapPin,
  Wallet,
} from "lucide-react";
import { useServiceEditor } from "@/features/appointments/kimi/services/use-service-editor";
import { useNextAvailable } from "@/features/appointments/kimi/services/use-next-available";
import { typeBelongsToSegment, type ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import { isServiceRow } from "@/lib/appointments/services/service-display";
import { ServiceObjectHeader } from "./service-object-header";
import { ServiceSummaryStrip } from "./service-summary-strip";
import { ServiceLocalNav } from "./service-local-nav";
import { ServiceSectionWorkspace } from "./service-section-workspace";
import { ServicesListPanel } from "./services-list-panel";
import { SERVICE_SECTIONS, type ServiceSectionId } from "./service-section-types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const VALID_SECTIONS = new Set<string>(SERVICE_SECTIONS.map((s) => s.id));

type Props = { serviceId: string | null };

export function ServicesWorkspaceConnected({ serviceId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editor = useServiceEditor(serviceId);
  const [listRows, setListRows] = useState<ApiTypeRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // The section lives in the URL so refresh, back and shared links all land in
  // the same place.
  const sectionParam = searchParams.get("section");
  const section: ServiceSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as ServiceSectionId)
      : "overview";

  const setSection = useCallback(
    (next: ServiceSectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("section");
      else params.set("section", next);
      const query = params.toString();
      router.replace(`/appointments/services/${serviceId}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams, serviceId],
  );

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListFailed(false);
    try {
      const res = await fetch("/api/appointments/types");
      if (!res.ok) throw new Error("failed");
      const json = await res.json();
      setListRows((json.data || []) as ApiTypeRow[]);
    } catch {
      setListFailed(true);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const services = useMemo(
    () => listRows.filter((r) => typeBelongsToSegment(r, "services") || isServiceRow(r)),
    [listRows],
  );

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of editor.options.staffOptions) map.set(s.id, s.name);
    return map;
  }, [editor.options.staffOptions]);

  const locationNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of editor.options.locationOptions) map.set(l.id, l.name);
    return map;
  }, [editor.options.locationOptions]);

  const phaseTotal = useMemo(
    () => editor.phases.reduce((sum, p) => sum + p.durationMinutes, 0),
    [editor.phases],
  );

  /**
   * Availability only needs to be re-read when a saved value that the slot
   * engine consumes changes, so the signature deliberately excludes cosmetic
   * fields like the description.
   */
  const availabilitySignature = [
    editor.saveStatus,
    editor.form.durationMinutes,
    editor.form.bufferBeforeMinutes,
    editor.form.bufferAfterMinutes,
    editor.form.startTimeMode,
    editor.form.customStartIntervalMinutes,
    editor.form.fixedStartTimes.join(","),
    editor.form.resourceIds.join(","),
    editor.form.namedScheduleId,
    phaseTotal,
  ].join("|");

  const nextAvailable = useNextAvailable(
    serviceId,
    editor.form.name,
    editor.form.enabled && editor.saveStatus === "saved",
    availabilitySignature,
  );

  const categoryName = useMemo(
    () => editor.options.categoryOptions.find((c) => c.id === editor.form.categoryId)?.name || "",
    [editor.form.categoryId, editor.options.categoryOptions],
  );

  /** Sections with something that blocks this service from being booked. */
  const attention = useMemo(() => {
    const flags = new Set<ServiceSectionId>();
    if (!editor.form.name.trim() || editor.form.durationMinutes < 5) flags.add("overview");
    if (editor.form.startTimeMode === "fixed" && editor.form.fixedStartTimes.length === 0) {
      flags.add("scheduling");
    }
    const pool =
      editor.form.staffAssignment === "collective"
        ? editor.form.collectiveStaffIds
        : editor.form.staffIds;
    if (editor.form.staffAssignment !== "any_eligible" && pool.length === 0) {
      flags.add("staff-place");
    }
    if (editor.form.paymentMode !== "none") {
      if (editor.form.paymentPriceCents <= 0 || !editor.form.paymentProvider) {
        flags.add("pricing-access");
      }
      if (
        editor.form.paymentMode === "deposit" &&
        editor.form.paymentDepositCents > editor.form.paymentPriceCents
      ) {
        flags.add("pricing-access");
      }
    }
    if (editor.form.groupBookingEnabled && editor.form.groupCapacity < 2) {
      flags.add("customer-setup");
    }
    return flags;
  }, [editor.form]);

  const selectService = useCallback(
    (id: string) => {
      router.push(`/appointments/services/${id}`);
      setMobileListOpen(false);
    },
    [router],
  );

  if (editor.loading && serviceId) {
    return (
      <div className={`${SHELL_CLASS} min-h-full animate-pulse p-6`}>
        <div className="h-8 w-48 rounded bg-[var(--border)]" />
        <div className="mt-6 h-[480px] rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    );
  }

  if (serviceId && editor.failed) {
    return (
      <div className={`${SHELL_CLASS} flex min-h-full items-center justify-center p-6`}>
        <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 text-[0.9375rem] font-semibold">Service not found</p>
          <Link href="/appointments/services" className="appt-pilot-muted-link mt-4 inline-block">
            Back to Services
          </Link>
        </div>
      </div>
    );
  }

  if (!serviceId) {
    const hasServices = services.length > 0;
    return (
      <div className={`${SHELL_CLASS} flex min-h-[calc(100vh-4rem)]`}>
        <div className="hidden lg:block">
          <ServicesListPanel
            services={services}
            selectedId={null}
            search={search}
            categoryId={categoryFilter}
            categoryOptions={editor.options.categoryOptions}
            staffNames={staffNames}
            locationNames={locationNames}
            onSearch={setSearch}
            onCategory={setCategoryFilter}
            onSelect={selectService}
            loading={listLoading}
          />
        </div>
        <div className="ws-empty-state flex-1">
          {listFailed ? (
            <>
              <div className="ws-empty-icon">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">Could not load services</h2>
              <p className="ws-empty-body">
                The services list did not respond. Your data is safe — try again.
              </p>
              <button
                type="button"
                className="appt-pilot-primary-btn mt-6"
                onClick={() => void loadList()}
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <div className="ws-empty-icon">
                <Briefcase className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">
                {hasServices ? "Select a service" : "No services yet"}
              </h2>
              <p className="ws-empty-body">
                {hasServices
                  ? "Pick a service to edit its scheduling, staff, pricing and customer setup."
                  : "Create a service customers can schedule with your business."}
              </p>
              <div className="ws-empty-hints">
                <span className="ws-empty-hint">
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                  Duration and processing time
                </span>
                <span className="ws-empty-hint">
                  <MapPin className="h-4 w-4" aria-hidden />
                  Staff, rooms and equipment
                </span>
                <span className="ws-empty-hint">
                  <Wallet className="h-4 w-4" aria-hidden />
                  Price, deposits and packages
                </span>
              </div>
              <Link
                href="/appointments/services/new"
                className="appt-pilot-primary-btn mt-6 inline-flex"
              >
                Create service
              </Link>
              {hasServices ? (
                <div className="mt-6 w-full max-w-xs lg:hidden">
                  <ServicesListPanel
                    services={services}
                    selectedId={null}
                    search={search}
                    categoryId={categoryFilter}
                    categoryOptions={editor.options.categoryOptions}
                    staffNames={staffNames}
                    locationNames={locationNames}
                    onSearch={setSearch}
                    onCategory={setCategoryFilter}
                    onSelect={selectService}
                    loading={listLoading}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL_CLASS} flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row`}>
      <div className={`${mobileListOpen ? "block" : "hidden"} lg:block`}>
        <ServicesListPanel
          services={services}
          selectedId={serviceId}
          search={search}
          categoryId={categoryFilter}
          categoryOptions={editor.options.categoryOptions}
          staffNames={staffNames}
          locationNames={locationNames}
          onSearch={setSearch}
          onCategory={setCategoryFilter}
          onSelect={selectService}
          loading={listLoading}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface-muted)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:hidden">
          <button
            type="button"
            className="appt-pilot-outline-btn flex-1 justify-between"
            aria-expanded={mobileListOpen}
            onClick={() => setMobileListOpen((v) => !v)}
          >
            <span className="truncate">{editor.form.name || "Select service"}</span>
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>

        <ServiceObjectHeader
          form={editor.form}
          categoryName={categoryName}
          saveStatus={editor.saveStatus}
          saving={editor.saving}
          error={editor.error}
          bookingLink={editor.bookingLink}
          copied={editor.copied}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onMenuClose={() => setMenuOpen(false)}
          onSave={() => void editor.save().then(() => void loadList())}
          onPreview={editor.previewBooking}
          onCopyLink={() => void editor.copyBookingLink()}
          onDuplicate={() => {
            setMenuOpen(false);
            void editor.duplicate().then(() => void loadList());
          }}
          onToggleActive={() => {
            setMenuOpen(false);
            void editor.setEnabled(!editor.form.enabled).then(() => void loadList());
          }}
        />

        <ServiceSummaryStrip
          form={editor.form}
          staffNames={staffNames}
          locationNames={locationNames}
          phaseTotalMinutes={phaseTotal}
          nextAvailable={nextAvailable}
        />

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <ServiceLocalNav active={section} onChange={setSection} attention={attention} />
          <ServiceSectionWorkspace
            section={section}
            editor={editor}
            staffNames={staffNames}
            locationNames={locationNames}
            onNavigateSection={setSection}
          />
        </div>
      </div>
    </div>
  );
}
