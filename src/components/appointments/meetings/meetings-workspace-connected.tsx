"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarCheck, ChevronDown, Link2, Users, Video } from "lucide-react";
import Link from "next/link";
import { useMeetingEditor } from "@/features/appointments/kimi/meetings/use-meeting-editor";
import { typeBelongsToSegment, type ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import {
  meetingSetupSteps,
  sectionsNeedingAttention,
} from "@/lib/appointments/meetings/meeting-setup";
import { MeetingObjectHeader } from "./meeting-object-header";
import { MeetingSummaryStrip } from "./meeting-summary-strip";
import { MeetingLocalNav } from "./meeting-local-nav";
import { MeetingSectionWorkspace } from "./meeting-section-workspace";
import { MeetingsListPanel } from "./meetings-list-panel";
import { MEETING_SECTIONS, type MeetingSectionId } from "./meeting-section-types";
import {
  APPOINTMENTS_MEETINGS_ROUTES,
  type MeetingsWorkspaceRoutes,
} from "@/lib/appointments/bookable-workspace-routes";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const VALID_SECTIONS = new Set<string>(MEETING_SECTIONS.map((s) => s.id));

type Props = {
  meetingId: string | null;
  routes?: MeetingsWorkspaceRoutes;
};

export function MeetingsWorkspaceConnected({
  meetingId,
  routes = APPOINTMENTS_MEETINGS_ROUTES,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editor = useMeetingEditor(meetingId);
  const [listRows, setListRows] = useState<ApiTypeRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);

  // Section lives in the URL so a refresh, a back button or a shared link all
  // land on the same part of the editor.
  const sectionParam = searchParams.get("section");
  const section: MeetingSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam)
      ? (sectionParam as MeetingSectionId)
      : "overview";

  const setSection = useCallback(
    (next: MeetingSectionId) => {
      router.replace(routes.detailWithSection(meetingId!, next), { scroll: false });
    },
    [meetingId, router, routes],
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

  const meetings = useMemo(
    () => listRows.filter((r) => typeBelongsToSegment(r, "meetings")),
    [listRows],
  );

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of editor.options.staffOptions) map.set(s.id, s.name);
    return map;
  }, [editor.options.staffOptions]);

  const attention = useMemo(
    () => sectionsNeedingAttention(meetingSetupSteps(editor.form)),
    [editor.form],
  );

  const selectMeeting = useCallback(
    (id: string) => {
      router.push(routes.detail(id));
      setMobileListOpen(false);
    },
    [router, routes],
  );

  if (editor.loading && meetingId) {
    return (
      <div className={`${SHELL_CLASS} min-h-full animate-pulse p-6`}>
        <div className="h-8 w-48 rounded bg-[var(--border)]" />
        <div className="mt-6 h-[480px] rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    );
  }

  if (meetingId && editor.failed) {
    return (
      <div className={`${SHELL_CLASS} flex min-h-full items-center justify-center p-6`}>
        <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 text-[0.9375rem] font-semibold">Meeting not found</p>
          <Link href={routes.list} className="appt-pilot-muted-link mt-4 inline-block">
            Back to Meetings
          </Link>
        </div>
      </div>
    );
  }

  if (!meetingId) {
    const hasMeetings = meetings.length > 0;
    return (
      <div className={`${SHELL_CLASS} flex min-h-[calc(100vh-4rem)]`}>
        <div className="hidden lg:block">
          <MeetingsListPanel
            meetings={meetings}
            selectedId={null}
            search={search}
            onSearch={setSearch}
            onSelect={selectMeeting}
            loading={listLoading}
            routes={routes}
          />
        </div>
        <div className="ws-empty-state flex-1">
          {listFailed ? (
            <>
              <div className="ws-empty-icon">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">Could not load meetings</h2>
              <p className="ws-empty-body">
                The meetings list did not respond. Your data is safe — try again.
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
                <Video className="h-6 w-6" aria-hidden />
              </div>
              <h2 className="ws-empty-title">
                {hasMeetings ? "Select a meeting" : "Schedule bookable meetings"}
              </h2>
              <p className="ws-empty-body">
                {hasMeetings
                  ? "Pick a meeting from the list to edit its availability, hosts, questions and booking rules."
                  : "Meetings are one-to-one or team calls customers book themselves — discovery calls, consultations and demos."}
              </p>
              <div className="ws-empty-hints">
                <span className="ws-empty-hint">
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                  Slots follow your availability
                </span>
                <span className="ws-empty-hint">
                  <Users className="h-4 w-4" aria-hidden />
                  Route to the right host
                </span>
                <span className="ws-empty-hint">
                  <Link2 className="h-4 w-4" aria-hidden />
                  Share one booking link
                </span>
              </div>
              <Link href={routes.new} className="appt-pilot-primary-btn mt-6 inline-flex">
                Create meeting
              </Link>
              {hasMeetings ? (
                <div className="mt-6 w-full max-w-xs lg:hidden">
                  <MeetingsListPanel
                    meetings={meetings}
                    selectedId={null}
                    search={search}
                    onSearch={setSearch}
                    onSelect={selectMeeting}
                    loading={listLoading}
                    routes={routes}
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
        <MeetingsListPanel
          meetings={meetings}
          selectedId={meetingId}
          search={search}
          onSearch={setSearch}
          onSelect={selectMeeting}
          routes={routes}
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
            <span className="truncate">{editor.form.name || "Select meeting"}</span>
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          </button>
        </div>

        <MeetingObjectHeader
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
            void editor.setEnabled(!editor.form.enabled).then(() => void loadList());
          }}
        />

        <MeetingSummaryStrip
          form={editor.form}
          staffNames={staffNames}
          namedScheduleOptions={editor.options.namedScheduleOptions}
        />

        <MeetingLocalNav active={section} onChange={setSection} attention={attention} />
        <MeetingSectionWorkspace
          section={section}
          form={editor.form}
          options={editor.options}
          staffNames={staffNames}
          bookingLink={editor.bookingLink}
          onFormChange={editor.updateForm}
          onNavigateSection={setSection}
          onPreview={editor.previewBooking}
          onCopyLink={() => void editor.copyBookingLink()}
          onAddStaff={editor.addStaffMember}
          onAddLocation={editor.addLocation}
          copied={editor.copied}
        />
      </div>
    </div>
  );
}
