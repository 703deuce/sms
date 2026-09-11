"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Briefcase } from "lucide-react";
import Link from "next/link";
import { useServiceEditor } from "@/features/appointments/kimi/services/use-service-editor";
import { typeBelongsToSegment, type ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import { ServiceObjectHeader } from "./service-object-header";
import { ServiceSummaryStrip } from "./service-summary-strip";
import { ServiceSectionTabs } from "./service-section-tabs";
import { ServiceSectionWorkspace } from "./service-section-workspace";
import { ServicesListPanel } from "./services-list-panel";
import type { ServiceSectionId } from "./service-section-types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

type Props = {
  serviceId: string | null;
};

export function ServicesWorkspaceConnected({ serviceId }: Props) {
  const router = useRouter();
  const editor = useServiceEditor(serviceId);
  const [listRows, setListRows] = useState<ApiTypeRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<ServiceSectionId>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);

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
    () => listRows.filter((r) => typeBelongsToSegment(r, "services")),
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

  const selectService = useCallback(
    (id: string) => {
      router.push(`/appointments/services/${id}`);
      setMobileListOpen(false);
    },
    [router],
  );

  const handleSave = useCallback(async () => {
    const savedId = await editor.save();
    if (savedId) {
      await loadList();
    }
  }, [editor, loadList]);

  const shellClass =
    "appt-overview-pilot bookable-workspace-pilot appt-pilot-workspace ref-root";

  if (editor.loading && serviceId) {
    return (
      <div className={`${shellClass} min-h-full animate-pulse p-6`}>
        <div className="h-8 w-48 rounded bg-[var(--border)]" />
        <div className="mt-6 h-[480px] rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    );
  }

  if (serviceId && editor.failed) {
    return (
      <div className={`${shellClass} flex min-h-full items-center justify-center p-6`}>
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 text-[15px] font-semibold">Service not found</p>
          <Link href="/appointments/services" className="appt-pilot-muted-link mt-4 inline-block">
            Back to Services
          </Link>
        </div>
      </div>
    );
  }

  if (!serviceId) {
    return (
      <div className={`${shellClass} flex min-h-[calc(100vh-4rem)]`}>
        <ServicesListPanel
          services={services}
          selectedId={null}
          search={search}
          onSearch={setSearch}
          onSelect={selectService}
          loading={listLoading}
        />
        <div className="ws-empty-state flex-1">
          {listFailed ? (
            <>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">Could not load services</p>
              <button type="button" className="appt-pilot-primary-btn mt-4" onClick={() => void loadList()}>
                Retry
              </button>
            </>
          ) : services.length === 0 && !listLoading ? (
            <>
              <div className="ws-empty-icon">
                <Briefcase className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">
                Create the services your customers book
              </h2>
              <p className="mt-2 max-w-sm text-[13px] text-[var(--text-secondary)]">
                Services are provider-based appointments — personal training, consultations, treatments, and more.
              </p>
              <Link href="/appointments/services/new" className="appt-pilot-primary-btn mt-6 inline-flex">
                Create service
              </Link>
            </>
          ) : (
            <>
              <div className="ws-empty-icon">
                <Briefcase className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="mt-4 text-[18px] font-semibold text-[var(--text-primary)]">Select a service</h2>
              <p className="mt-2 max-w-sm text-[13px] text-[var(--text-secondary)]">
                Choose a service from the list to manage scheduling, staff, pricing, and customer setup.
              </p>
              <Link href="/appointments/services/new" className="appt-pilot-primary-btn mt-6 inline-flex">
                Create service
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${shellClass} flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row`}>
      <div className={`${mobileListOpen ? "block" : "hidden"} lg:block`}>
        <ServicesListPanel
          services={services}
          selectedId={serviceId}
          search={search}
          onSearch={setSearch}
          onSelect={selectService}
          loading={listLoading}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface-muted)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:hidden">
          <button
            type="button"
            className="appt-pilot-outline-btn flex-1 justify-between"
            onClick={() => setMobileListOpen((v) => !v)}
          >
            {editor.form.name || "Select service"}
          </button>
        </div>

        <ServiceObjectHeader
          form={editor.form}
          saveStatus={editor.saveStatus}
          saving={editor.saving}
          isCreating={false}
          error={editor.error}
          bookingLink={editor.bookingLink}
          copied={editor.copied}
          menuOpen={menuOpen}
          onMenuToggle={() => setMenuOpen((v) => !v)}
          onSave={() => void handleSave()}
          onPreview={editor.previewBooking}
          onCopyLink={() => void editor.copyBookingLink()}
          onDuplicate={() => void editor.duplicate().then(() => void loadList())}
          onToggleActive={() => void editor.setEnabled(!editor.form.enabled)}
        />

        <ServiceSummaryStrip
          form={editor.form}
          staffNames={staffNames}
          locationNames={locationNames}
          namedScheduleOptions={editor.options.namedScheduleOptions}
        />

        <ServiceSectionTabs active={section} onChange={setSection} />

        <ServiceSectionWorkspace
          section={section}
          form={editor.form}
          options={editor.options}
          staffNames={staffNames}
          locationNames={locationNames}
          serviceId={editor.serviceId}
          isCreating={false}
          bookingLink={editor.bookingLink}
          onFormChange={editor.updateForm}
          onNavigateSection={setSection}
          onPersistDraft={editor.persistDraft}
        />
      </div>
    </div>
  );
}
