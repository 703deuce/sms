"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Copy, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { typeBelongsToSegment, type ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import {
  hostAssignmentLabel,
  meetingIsActive,
  meetingMethodLabel,
} from "@/lib/appointments/meetings/meeting-display";
import "@/components/appointments/kimi-ui/overview/reference.css";

export function MeetingsListConnected() {
  const [rows, setRows] = useState<ApiTypeRow[]>([]);
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
      ]);
      if (!typesRes.ok) throw new Error("types failed");
      const typesJson = await typesRes.json();
      setRows((typesJson.data || []) as ApiTypeRow[]);
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const platform = settingsJson.data?.platform || settingsJson.platform || {};
        setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
        const map = new Map<string, string>();
        for (const s of platform.staff || []) {
          if (s.id && s.name) map.set(s.id, s.name);
        }
        setStaffNames(map);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const meetings = useMemo(
    () => rows.filter((r) => typeBelongsToSegment(r, "meetings")),
    [rows],
  );

  const activeCount = meetings.filter(meetingIsActive).length;

  const copyLink = useCallback(
    async (id: string) => {
      if (!workspaceSlug) return;
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/book/${encodeURIComponent(workspaceSlug)}/${encodeURIComponent(id)}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(id);
        window.setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // ignore
      }
    },
    [workspaceSlug],
  );

  const duplicateMeeting = useCallback(
    async (row: ApiTypeRow) => {
      await fetch("/api/appointments/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} (copy)`,
          durationMinutes: row.durationMinutes ?? 30,
          bufferMinutes: 0,
          config: { ...(row.config || {}), bookingTypeKind: "MEETING" },
        }),
      });
      await load();
    },
    [load],
  );

  const toggleEnabled = useCallback(
    async (row: ApiTypeRow, enabled: boolean) => {
      const config = { ...(row.config || {}), enabled, bookingTypeKind: "MEETING" as const };
      await fetch(`/api/appointments/types/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: row.name,
          durationMinutes: row.durationMinutes,
          config,
        }),
      });
      await load();
    },
    [load],
  );

  if (loading) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="mt-6 h-64 rounded-xl border border-[var(--border)] bg-white" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 appt-pilot-text-section">Could not load meetings</p>
          <button type="button" className="mt-5 appt-pilot-primary-btn" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/types" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Booking Types
      </Link>

      <RefDecoPageHeader
        title="Meetings"
        description="Create simple meeting types for calls, consultations, demos, interviews, and virtual or in-person meetings."
        action={
          <Link href="/appointments/types/meetings/new" className="appt-pilot-primary-btn">
            <Plus size={15} strokeWidth={2.5} aria-hidden />
            Create meeting
          </Link>
        }
      />

      {meetings.length === 0 ? (
        <div className="appt-pilot-empty-state mt-6">
          <h2 className="appt-pilot-text-section">Schedule calls without the back-and-forth</h2>
          <p className="mx-auto mt-2 max-w-lg appt-pilot-text-body text-[var(--text-secondary)]">
            Meetings are ideal for consultations, demos, interviews, and other appointments where customers simply choose a time.
          </p>
          <Link href="/appointments/types/meetings/new" className="appt-pilot-primary-btn mt-5">
            Create your first meeting
          </Link>
        </div>
      ) : (
        <div className="appt-pilot-data-table-wrap mt-6">
          <div className="appt-pilot-data-table-meta">
            {activeCount} active · {meetings.length} total
          </div>
          <table className="appt-pilot-data-table">
            <thead>
              <tr>
                <th scope="col">Meeting</th>
                <th scope="col">Duration</th>
                <th scope="col">Hosts</th>
                <th scope="col">Method</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((row) => {
                const active = meetingIsActive(row);
                return (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/appointments/types/meetings/${row.id}`}
                        className="appt-pilot-muted-link font-medium !text-[var(--text-primary)] hover:!text-[var(--brand-accent)]"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td>{row.durationMinutes ? `${row.durationMinutes} min` : "—"}</td>
                    <td>{hostAssignmentLabel(row.config, staffNames)}</td>
                    <td>{meetingMethodLabel(row.config)}</td>
                    <td>
                      <span className={active ? "appt-pilot-status-active" : "appt-pilot-status-inactive"}>
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Link
                          href={`/appointments/types/meetings/${row.id}`}
                          className="appt-pilot-outline-btn !min-h-8 !px-2"
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil size={14} aria-hidden />
                        </Link>
                        <button
                          type="button"
                          className="appt-pilot-outline-btn !min-h-8 !px-2"
                          aria-label={`Copy link for ${row.name}`}
                          onClick={() => void copyLink(row.id)}
                        >
                          <Copy size={14} aria-hidden />
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            className="appt-pilot-outline-btn !min-h-8 !px-2"
                            aria-label={`More actions for ${row.name}`}
                            onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                          >
                            <MoreHorizontal size={14} aria-hidden />
                          </button>
                          {openMenuId === row.id ? (
                            <div className="absolute right-0 z-10 mt-1 min-w-[9rem] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]"
                                onClick={() => { setOpenMenuId(null); void duplicateMeeting(row); }}
                              >
                                Duplicate
                              </button>
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left appt-pilot-text-list hover:bg-[var(--surface-muted)]"
                                onClick={() => { setOpenMenuId(null); void toggleEnabled(row, !active); }}
                              >
                                {active ? "Disable" : "Enable"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {copiedId === row.id ? (
                        <span className="block appt-pilot-text-helper mt-1">Link copied</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
