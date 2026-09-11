"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useMeetingEditor } from "@/features/appointments/kimi/meetings/use-meeting-editor";
import { typeBelongsToSegment, type ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import { MeetingObjectHeader } from "./meeting-object-header";
import { MeetingSummaryStrip } from "./meeting-summary-strip";
import { MeetingLocalNav } from "./meeting-local-nav";
import { MeetingSectionWorkspace } from "./meeting-section-workspace";
import { MeetingsListPanel } from "./meetings-list-panel";
import type { MeetingSectionId } from "./meeting-section-types";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

type Props = {
  meetingId: string | null;
};

export function MeetingsWorkspaceConnected({ meetingId }: Props) {
  const router = useRouter();
  const editor = useMeetingEditor(meetingId);
  const [listRows, setListRows] = useState<ApiTypeRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listFailed, setListFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<MeetingSectionId>("overview");
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

  const meetings = useMemo(
    () => listRows.filter((r) => typeBelongsToSegment(r, "meetings")),
    [listRows],
  );

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of editor.options.staffOptions) map.set(s.id, s.name);
    return map;
  }, [editor.options.staffOptions]);

  const selectMeeting = useCallback(
    (id: string) => {
      router.push(`/appointments/meetings/${id}`);
      setMobileListOpen(false);
    },
    [router],
  );

  if (editor.loading && meetingId) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full animate-pulse p-6">
        <div className="h-8 w-48 rounded bg-[var(--border)]" />
        <div className="mt-6 h-[480px] rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    );
  }

  if (meetingId && editor.failed) {
    return (
      <div className="appt-overview-pilot ref-root flex min-h-full items-center justify-center p-6">
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 text-[15px] font-semibold">Meeting not found</p>
          <Link href="/appointments/meetings" className="appt-pilot-muted-link mt-4 inline-block">
            Back to Meetings
          </Link>
        </div>
      </div>
    );
  }

  if (!meetingId) {
    return (
      <div className="appt-overview-pilot ref-root flex min-h-[calc(100vh-4rem)]">
        <MeetingsListPanel
          meetings={meetings}
          selectedId={null}
          search={search}
          onSearch={setSearch}
          onSelect={selectMeeting}
          loading={listLoading}
        />
        <div className="flex flex-1 flex-col items-center justify-center bg-[var(--surface-muted)] p-8 text-center">
          {listFailed ? (
            <>
              <p className="text-[14px] font-medium text-[var(--text-primary)]">Could not load meetings</p>
              <button type="button" className="appt-pilot-primary-btn mt-4" onClick={() => void loadList()}>
                Retry
              </button>
            </>
          ) : meetings.length === 0 && !listLoading ? (
            <>
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">Schedule bookable meetings</h2>
              <p className="mt-2 max-w-sm text-[13px] text-[var(--text-secondary)]">
                Meetings are one-on-one or team calls customers can book — discovery calls, consultations, demos, and more.
              </p>
              <Link href="/appointments/meetings/new" className="appt-pilot-primary-btn mt-6 inline-flex">
                Create meeting
              </Link>
            </>
          ) : (
            <>
              <p className="text-[14px] text-[var(--text-secondary)]">Select a meeting from the list to edit.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="appt-overview-pilot ref-root flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      <div className={`${mobileListOpen ? "block" : "hidden"} lg:block`}>
        <MeetingsListPanel
          meetings={meetings}
          selectedId={meetingId}
          search={search}
          onSearch={setSearch}
          onSelect={selectMeeting}
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
            {editor.form.name || "Select meeting"}
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
          onSave={() => void editor.save().then(() => void loadList())}
          onPreview={editor.previewBooking}
          onCopyLink={() => void editor.copyBookingLink()}
          onDuplicate={() => void editor.duplicate().then(() => void loadList())}
          onToggleActive={() => void editor.setEnabled(!editor.form.enabled)}
        />

        <MeetingSummaryStrip
          form={editor.form}
          staffNames={staffNames}
          namedScheduleOptions={editor.options.namedScheduleOptions}
        />

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <MeetingLocalNav active={section} onChange={setSection} mobile />
          <MeetingLocalNav active={section} onChange={setSection} />
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
            copied={editor.copied}
          />
        </div>
      </div>
    </div>
  );
}
