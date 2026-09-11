"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  MapPin,
  Presentation,
  Users,
  X,
} from "lucide-react";
import { useWorkshopEditor } from "@/features/appointments/kimi/workshops/use-workshop-editor";
import type { WorkshopSeriesRow } from "@/lib/appointments/workshops/workshop-form";
import { upcomingSessions } from "@/lib/appointments/workshops/workshop-schedule";
import { Modal } from "@/components/appointments/workspace-ui";
import { WorkshopsListPanel, type WorkshopListFilter } from "./workshops-list-panel";
import { WorkshopLocalNav } from "./workshop-local-nav";
import { WorkshopObjectHeader } from "./workshop-object-header";
import { WorkshopSectionWorkspace } from "./workshop-section-workspace";
import { WorkshopSummaryStrip } from "./workshop-summary-strip";
import { WORKSHOP_SECTIONS, type WorkshopSectionId } from "./workshop-section-types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const VALID_SECTIONS = new Set<string>(WORKSHOP_SECTIONS.map((s) => s.id));

type Props = { workshopId: string | null };

export function WorkshopsWorkspaceConnected({ workshopId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editor = useWorkshopEditor(workshopId);
  const [listRows, setListRows] = useState<WorkshopSeriesRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WorkshopListFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);

  const sectionParam = searchParams.get("section");
  const section: WorkshopSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as WorkshopSectionId)
      : "overview";

  const setSection = useCallback(
    (next: WorkshopSectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("section");
      else params.set("section", next);
      const query = params.toString();
      router.replace(`/appointments/workshops/${workshopId}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [router, searchParams, workshopId],
  );

  // The route filters by offering kind server-side, so a class can never reach
  // this list even though both live in the same table.
  const loadList = useCallback(async () => {
    setListLoading(true);
    setListFailed(false);
    try {
      const res = await fetch("/api/appointments/service-booking/workshops");
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as { data?: WorkshopSeriesRow[] };
      setListRows(json.data || []);
    } catch {
      setListFailed(true);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // The wizard hands the confirmation over in the URL. It is read once and
  // then stripped, so reloading the page does not announce it again.
  const createdParam = searchParams.get("created");
  useEffect(() => {
    if (!createdParam || !workshopId) return;
    setCreatedNotice(
      createdParam === "nosession"
        ? "Workshop created — but its date could not be saved. Set it in Date & time."
        : "Workshop created",
    );
    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    const query = params.toString();
    router.replace(`/appointments/workshops/${workshopId}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }, [createdParam, router, searchParams, workshopId]);

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

  const intakeFormNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of editor.options.intakeFormOptions) map.set(f.id, f.name);
    return map;
  }, [editor.options.intakeFormOptions]);

  const registeredCount = useMemo(
    () => editor.registrants.filter((r) => r.status !== "cancelled").length,
    [editor.registrants],
  );

  /** Sections holding something that stops this workshop taking registrations. */
  const attention = useMemo(() => {
    const flags = new Set<WorkshopSectionId>();
    const { form } = editor;
    if (!form.name.trim()) flags.add("overview");
    if (upcomingSessions(editor.sessions).length === 0) flags.add("date-time");
    if (!form.staffId) flags.add("place");
    if (form.locationMode === "in_person" && !form.locationId) flags.add("place");
    if (form.locationMode === "virtual" && !form.virtualUrl.trim()) flags.add("place");
    if (form.capacity < 1) flags.add("registration");
    if (
      form.registrationOpensAt &&
      form.registrationClosesAt &&
      new Date(form.registrationOpensAt) >= new Date(form.registrationClosesAt)
    ) {
      flags.add("registration");
    }
    if (!form.isFree && form.priceCents <= 0) flags.add("pricing-access");
    return flags;
  }, [editor]);

  const selectWorkshop = useCallback(
    (id: string) => {
      router.push(`/appointments/workshops/${id}`);
      setMobileListOpen(false);
    },
    [router],
  );

  if (editor.loading && workshopId) {
    return (
      <div className={`${SHELL_CLASS} min-h-full animate-pulse p-6`}>
        <div className="h-8 w-48 rounded bg-[var(--border)]" />
        <div className="mt-6 h-[480px] rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    );
  }

  if (workshopId && editor.failed) {
    return (
      <div className={`${SHELL_CLASS} flex min-h-full items-center justify-center p-6`}>
        <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 text-[0.9375rem] font-semibold">Workshop not found</p>
          <Link href="/appointments/workshops" className="appt-pilot-muted-link mt-4 inline-block">
            Back to Workshops
          </Link>
        </div>
      </div>
    );
  }

  if (!workshopId) {
    const hasWorkshops = listRows.length > 0;
    return (
      <div className={`${SHELL_CLASS} flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row`}>
        {/* One list, not one per breakpoint: two copies would be two "Workshops
            list" landmarks and two sets of the same controls. */}
        <div className={hasWorkshops ? "block" : "hidden lg:block"}>
          <WorkshopsListPanel
            workshops={listRows}
            selectedId={null}
            search={search}
            filter={filter}
            onSearch={setSearch}
            onFilter={setFilter}
            onSelect={selectWorkshop}
            loading={listLoading}
          />
        </div>
        <div className="ws-empty-state flex-1">
          {listFailed ? (
            <>
              <div className="ws-empty-icon">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">Could not load workshops</h2>
              <p className="ws-empty-body">
                The workshops list did not respond. Your data is safe — try again.
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
                <Presentation className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">
                {hasWorkshops ? "Select a workshop" : "No workshops yet"}
              </h2>
              <p className="ws-empty-body">
                {hasWorkshops
                  ? "Pick a workshop to edit its date, place, registration and pricing."
                  : "Run a one-off event on a set date that customers register for in advance."}
              </p>
              <div className="ws-empty-hints">
                <span className="ws-empty-hint">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  A set date
                </span>
                <span className="ws-empty-hint">
                  <Users className="h-4 w-4" aria-hidden />
                  Registrants and waitlist
                </span>
                <span className="ws-empty-hint">
                  <MapPin className="h-4 w-4" aria-hidden />
                  In person or online
                </span>
              </div>
              <Link
                href="/appointments/workshops/new"
                className="appt-pilot-primary-btn mt-6 inline-flex"
              >
                Create workshop
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL_CLASS} flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row`}>
      <div className={`${mobileListOpen ? "block" : "hidden"} lg:block`}>
        <WorkshopsListPanel
          workshops={listRows}
          selectedId={workshopId}
          search={search}
          filter={filter}
          onSearch={setSearch}
          onFilter={setFilter}
          onSelect={selectWorkshop}
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
            <span className="truncate">{editor.form.name || "Select workshop"}</span>
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>

        {createdNotice ? (
          <div className="ws-toast" role="status">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {createdNotice}
            <button type="button" aria-label="Dismiss" onClick={() => setCreatedNotice(null)}>
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        <WorkshopObjectHeader
          form={editor.form}
          sessions={editor.sessions}
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
          onCancelWorkshop={() => {
            setMenuOpen(false);
            setConfirmCancel(true);
          }}
          onReopenWorkshop={() => {
            setMenuOpen(false);
            void editor.reopenWorkshop().then(() => void loadList());
          }}
          onToggleActive={() => {
            setMenuOpen(false);
            void editor.setActive(!editor.form.active).then(() => void loadList());
          }}
          onDelete={() => {
            setMenuOpen(false);
            setConfirmDelete(true);
          }}
        />

        <WorkshopSummaryStrip
          form={editor.form}
          sessions={editor.sessions}
          registeredCount={registeredCount}
          staffNames={staffNames}
          locationNames={locationNames}
        />

        <WorkshopLocalNav active={section} onChange={setSection} attention={attention} />
        <WorkshopSectionWorkspace
          section={section}
          editor={editor}
          staffNames={staffNames}
          locationNames={locationNames}
          intakeFormNames={intakeFormNames}
          onNavigateSection={setSection}
        />
      </div>

      {confirmCancel ? (
        <Modal
          title="Cancel this workshop?"
          description="Registration stops and the workshop leaves your public page. Registrations already taken are kept on the record."
          onClose={() => setConfirmCancel(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setConfirmCancel(false)}
              >
                Keep it running
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={editor.saving}
                onClick={() => {
                  void editor.cancelWorkshop().then((ok) => {
                    setConfirmCancel(false);
                    if (ok) void loadList();
                  });
                }}
              >
                {editor.saving ? "Cancelling…" : "Cancel workshop"}
              </button>
            </>
          }
        >
          {registeredCount > 0 ? (
            <p className="ws-inline-error" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {registeredCount} {registeredCount === 1 ? "person is" : "people are"} registered.
              Cancelling does not message them and does not refund anything — tell them yourself and
              settle any payments you took.
            </p>
          ) : (
            <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
              Nobody is registered yet, so there is nothing to unwind. You can reopen the workshop
              later from the same menu.
            </p>
          )}
        </Modal>
      ) : null}

      {confirmDelete ? (
        <Modal
          title="Delete this workshop?"
          description="Sessions are deleted with it. A workshop anyone is registered for cannot be deleted — cancel it instead."
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setConfirmDelete(false)}
              >
                Keep workshop
              </button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                disabled={editor.saving}
                onClick={() => {
                  void editor.remove().then((ok) => {
                    setConfirmDelete(false);
                    if (ok) void loadList();
                  });
                }}
              >
                {editor.saving ? "Deleting…" : "Delete workshop"}
              </button>
            </>
          }
        >
          <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
            {editor.form.name || "This workshop"} will be removed from the workshops list and from
            your public page.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
