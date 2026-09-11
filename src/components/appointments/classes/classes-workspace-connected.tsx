"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  Users,
  Wallet,
} from "lucide-react";
import { useClassEditor } from "@/features/appointments/kimi/classes/use-class-editor";
import { resolveClassSeriesOfferingKind } from "@/lib/appointments/class-series-offering";
import type { ClassSeriesRow } from "@/lib/appointments/classes/class-form";
import { Modal } from "@/components/appointments/workspace-ui";
import { ClassesListPanel } from "./classes-list-panel";
import { ClassLocalNav } from "./class-local-nav";
import { ClassObjectHeader } from "./class-object-header";
import { ClassSectionWorkspace } from "./class-section-workspace";
import { ClassSummaryStrip } from "./class-summary-strip";
import { CLASS_SECTIONS, type ClassSectionId } from "./class-section-types";
import { upcomingOccurrences } from "@/lib/appointments/classes/class-summary";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const VALID_SECTIONS = new Set<string>(CLASS_SECTIONS.map((s) => s.id));

type Props = { classId: string | null };

export function ClassesWorkspaceConnected({ classId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editor = useClassEditor(classId);
  const [listRows, setListRows] = useState<ClassSeriesRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sectionParam = searchParams.get("section");
  const section: ClassSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as ClassSectionId)
      : "overview";

  const setSection = useCallback(
    (next: ClassSectionId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("section");
      else params.set("section", next);
      const query = params.toString();
      router.replace(`/appointments/classes/${classId}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [classId, router, searchParams],
  );

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListFailed(false);
    try {
      const res = await fetch("/api/appointments/service-booking/classes");
      if (!res.ok) throw new Error("failed");
      const json = (await res.json()) as { data?: ClassSeriesRow[] };
      // Classes and workshops share one table and are told apart only by
      // metadata, so this filter is what keeps a workshop off the Classes page.
      setListRows(
        (json.data || []).filter((row) => resolveClassSeriesOfferingKind(row.metadata) === "class"),
      );
    } catch {
      setListFailed(true);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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

  /** Sections holding something that stops this class taking registrations. */
  const attention = useMemo(() => {
    const flags = new Set<ClassSectionId>();
    const { form } = editor;
    if (!form.name.trim()) flags.add("overview");
    if (upcomingOccurrences(editor.occurrences).length === 0) flags.add("schedule");
    if (!form.staffId || !form.locationId) flags.add("people-place");
    if (form.capacity < 1) flags.add("capacity");
    if (
      form.registrationOpensAt &&
      form.registrationClosesAt &&
      new Date(form.registrationOpensAt) >= new Date(form.registrationClosesAt)
    ) {
      flags.add("capacity");
    }
    if (!form.isFree && form.priceCents <= 0) flags.add("pricing-access");
    return flags;
  }, [editor]);

  const selectClass = useCallback(
    (id: string) => {
      router.push(`/appointments/classes/${id}`);
      setMobileListOpen(false);
    },
    [router],
  );

  if (editor.loading && classId) {
    return (
      <div className={`${SHELL_CLASS} min-h-full animate-pulse p-6`}>
        <div className="h-8 w-48 rounded bg-[var(--border)]" />
        <div className="mt-6 h-[480px] rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    );
  }

  if (classId && editor.failed) {
    return (
      <div className={`${SHELL_CLASS} flex min-h-full items-center justify-center p-6`}>
        <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 text-[0.9375rem] font-semibold">Class not found</p>
          <Link href="/appointments/classes" className="appt-pilot-muted-link mt-4 inline-block">
            Back to Classes
          </Link>
        </div>
      </div>
    );
  }

  if (!classId) {
    const hasClasses = listRows.length > 0;
    return (
      <div className={`${SHELL_CLASS} flex min-h-[calc(100vh-4rem)]`}>
        <div className="hidden lg:block">
          <ClassesListPanel
            classes={listRows}
            selectedId={null}
            search={search}
            onSearch={setSearch}
            onSelect={selectClass}
            loading={listLoading}
          />
        </div>
        <div className="ws-empty-state flex-1">
          {listFailed ? (
            <>
              <div className="ws-empty-icon">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">Could not load classes</h2>
              <p className="ws-empty-body">
                The classes list did not respond. Your data is safe — try again.
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
                <Users className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">{hasClasses ? "Select a class" : "No classes yet"}</h2>
              <p className="ws-empty-body">
                {hasClasses
                  ? "Pick a class to edit its schedule, capacity, pricing and customer setup."
                  : "Create a scheduled group session customers can register for."}
              </p>
              <div className="ws-empty-hints">
                <span className="ws-empty-hint">
                  <CalendarClock className="h-4 w-4" aria-hidden />
                  Repeating sessions
                </span>
                <span className="ws-empty-hint">
                  <Users className="h-4 w-4" aria-hidden />
                  Seats, registrants and waitlist
                </span>
                <span className="ws-empty-hint">
                  <Wallet className="h-4 w-4" aria-hidden />
                  Price, packages and memberships
                </span>
              </div>
              <Link href="/appointments/classes/new" className="appt-pilot-primary-btn mt-6 inline-flex">
                Create class
              </Link>
              {hasClasses ? (
                <div className="mt-6 w-full max-w-xs lg:hidden">
                  <ClassesListPanel
                    classes={listRows}
                    selectedId={null}
                    search={search}
                    onSearch={setSearch}
                    onSelect={selectClass}
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
        <ClassesListPanel
          classes={listRows}
          selectedId={classId}
          search={search}
          onSearch={setSearch}
          onSelect={selectClass}
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
            <span className="truncate">{editor.form.name || "Select class"}</span>
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>

        <ClassObjectHeader
          form={editor.form}
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
            void editor.setActive(!editor.form.active).then(() => void loadList());
          }}
          onDelete={() => {
            setMenuOpen(false);
            setConfirmDelete(true);
          }}
        />

        <ClassSummaryStrip
          form={editor.form}
          occurrences={editor.occurrences}
          waitlistCount={editor.waitlist.length}
          staffNames={staffNames}
          locationNames={locationNames}
        />

        <ClassLocalNav active={section} onChange={setSection} attention={attention} />
        <ClassSectionWorkspace
          section={section}
          editor={editor}
          staffNames={staffNames}
          locationNames={locationNames}
          intakeFormNames={intakeFormNames}
          onNavigateSection={setSection}
        />
      </div>

      {confirmDelete ? (
        <Modal
          title="Delete this class?"
          description="Sessions are deleted with it. A class anyone is registered for cannot be deleted — deactivate it instead."
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button
                type="button"
                className="appt-pilot-outline-btn"
                onClick={() => setConfirmDelete(false)}
              >
                Keep class
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
                {editor.saving ? "Deleting…" : "Delete class"}
              </button>
            </>
          }
        >
          <p className="text-[var(--type-list)] text-[var(--text-secondary)]">
            {editor.form.name || "This class"} will be removed from the classes list and from your
            public page.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
