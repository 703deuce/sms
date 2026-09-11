"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import {
  segmentById,
  typeBelongsToSegment,
  type ApiTypeRow,
  type BookingTypesSegmentId,
} from "@/lib/appointments/booking-types-segments";
import {
  type ClassSeriesRow,
  classCapacityLabel,
  classIsActive,
  enrolledCount,
  instructorLabel,
  locationLabel,
  nextOccurrenceSummary,
  scheduleSummaryForClass,
  visibilityLabel,
} from "@/lib/appointments/classes/class-display";
import { labelsForPresentation } from "@/lib/appointments/classes/class-labels";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Props = {
  segmentId: "classes" | "workshops";
};

export function GroupBookingListConnected({ segmentId }: Props) {
  const segment = segmentById(segmentId);
  const labels = labelsForPresentation(segment.classPresentation ?? "recurring_class");
  const isWorkshop = segmentId === "workshops";

  const [rows, setRows] = useState<ApiTypeRow[]>([]);
  const [seriesByType, setSeriesByType] = useState<Map<string, ClassSeriesRow>>(new Map());
  const [staffNames, setStaffNames] = useState<Map<string, string>>(new Map());
  const [locationNames, setLocationNames] = useState<Map<string, string>>(new Map());
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const basePath =
    segmentId === "workshops" ? "/appointments/types/workshops" : "/appointments/types/classes";

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [typesRes, settingsRes, seriesRes] = await Promise.all([
        fetch("/api/appointments/types"),
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/service-booking/classes"),
      ]);
      if (!typesRes.ok) throw new Error("types failed");
      const typesJson = await typesRes.json();
      setRows((typesJson.data || []) as ApiTypeRow[]);

      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const platform = settingsJson.data?.platform || settingsJson.platform || {};
        setWorkspaceSlug(settingsJson.data?.workspaceSlug || settingsJson.workspaceSlug || "");
        const staffMap = new Map<string, string>();
        for (const s of platform.staff || []) {
          if (s.id && s.name) staffMap.set(s.id, s.name);
        }
        setStaffNames(staffMap);
        const locMap = new Map<string, string>();
        for (const l of platform.locations || []) {
          if (l.id && l.name) locMap.set(l.id, l.name);
        }
        setLocationNames(locMap);
      }

      if (seriesRes.ok) {
        const seriesJson = await seriesRes.json();
        const map = new Map<string, ClassSeriesRow>();
        for (const s of (seriesJson.data || []) as ClassSeriesRow[]) {
          if (s.appointmentTypeId) map.set(s.appointmentTypeId, s);
        }
        setSeriesByType(map);
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

  const filtered = useMemo(
    () => rows.filter((r) => typeBelongsToSegment(r, segmentId)),
    [rows, segmentId],
  );

  const activeCount = filtered.filter(classIsActive).length;

  const bookingUrl = useCallback(() => {
    if (!workspaceSlug) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/book/${encodeURIComponent(workspaceSlug)}/classes`;
  }, [workspaceSlug]);

  const copyLink = useCallback(async () => {
    const url = bookingUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId("hub");
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }, [bookingUrl]);

  const duplicateRow = useCallback(
    async (row: ApiTypeRow) => {
      const presentation = segment.classPresentation ?? "recurring_class";
      await fetch("/api/appointments/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${row.name} (copy)`,
          durationMinutes: row.durationMinutes ?? 60,
          bufferMinutes: 0,
          config: {
            ...(row.config || {}),
            bookingTypeKind: "CLASS",
            classPresentation: presentation,
          },
        }),
      });
      await load();
    },
    [load, segment.classPresentation],
  );

  const toggleEnabled = useCallback(
    async (row: ApiTypeRow, enabled: boolean) => {
      const config = {
        ...(row.config || {}),
        enabled,
        bookingTypeKind: "CLASS" as const,
        classPresentation: segment.classPresentation ?? "recurring_class",
      };
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
    [load, segment.classPresentation],
  );

  const nextOccurrenceId = (series?: ClassSeriesRow | null): string | null => {
    if (!series?.occurrences?.length) return null;
    const now = Date.now();
    const upcoming = series.occurrences
      .filter((o) => o.status === "scheduled" && new Date(o.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return upcoming[0]?.id ?? null;
  };

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
          <p className="mt-3 appt-pilot-text-section">Could not load {labels.itemPlural.toLowerCase()}</p>
          <button type="button" className="mt-5 appt-pilot-primary-btn" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  const emptyTitle = isWorkshop
    ? "Create your first workshop or event"
    : "Start offering group classes";
  const emptyBody = isWorkshop
    ? "Take registrations for one-time workshops, seminars, special events, and other limited-run group sessions."
    : "Classes let multiple customers enroll in the same scheduled session with capacity, attendance, and waitlist support.";

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <Link href="/appointments/types" className="appt-pilot-back-link">
        <ArrowLeft size={14} aria-hidden />
        Booking Types
      </Link>

      <RefDecoPageHeader
        title={segment.title}
        description={segment.description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="appt-pilot-outline-btn" onClick={() => void copyLink()}>
              <Copy size={14} aria-hidden /> {copiedId === "hub" ? "Copied" : "Copy booking link"}
            </button>
            <Link href={`${basePath}/new`} className="appt-pilot-primary-btn">
              <Plus size={15} strokeWidth={2.5} aria-hidden />
              {labels.createLabel}
            </Link>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <div className="appt-pilot-empty-state mt-6">
          <h2 className="appt-pilot-text-section">{emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-lg appt-pilot-text-body text-[var(--text-secondary)]">{emptyBody}</p>
          <Link href={`${basePath}/new`} className="appt-pilot-primary-btn mt-5">
            {labels.createFirstLabel}
          </Link>
        </div>
      ) : (
        <div className="appt-pilot-data-table-wrap mt-6">
          <div className="appt-pilot-data-table-meta">
            {activeCount} active · {filtered.length} total
          </div>
          <table className="appt-pilot-data-table">
            <thead>
              <tr>
                <th scope="col">{isWorkshop ? "Event" : "Class"}</th>
                <th scope="col">{labels.hostLabel}</th>
                <th scope="col">Location</th>
                <th scope="col">{isWorkshop ? "Date" : "Schedule"}</th>
                {!isWorkshop ? <th scope="col">Next session</th> : null}
                <th scope="col">Capacity</th>
                <th scope="col">{isWorkshop ? "Registered" : "Enrolled"}</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const active = classIsActive(row);
                const series = seriesByType.get(row.id);
                const staffId = series?.staffId || row.config?.staffIds?.[0];
                const locationId = series?.locationId || row.config?.locationId;
                const occId = nextOccurrenceId(series);
                return (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`${basePath}/${row.id}`}
                        className="appt-pilot-muted-link font-medium !text-[var(--text-primary)] hover:!text-[var(--brand-accent)]"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td>{instructorLabel(staffId, staffNames)}</td>
                    <td>{locationLabel(locationId, locationNames)}</td>
                    <td>{isWorkshop ? nextOccurrenceSummary(series) : scheduleSummaryForClass(series)}</td>
                    {!isWorkshop ? <td>{nextOccurrenceSummary(series)}</td> : null}
                    <td>{classCapacityLabel(row.config)}</td>
                    <td>{enrolledCount(series)}</td>
                    <td>
                      <span className={active ? "appt-pilot-status-active" : "appt-pilot-status-inactive"}>
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Link
                          href={`${basePath}/${row.id}`}
                          className="appt-pilot-outline-btn !min-h-8 !px-2"
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil size={14} aria-hidden />
                        </Link>
                        {occId ? (
                          <Link
                            href={`/appointments/classes/occurrences/${occId}`}
                            className="appt-pilot-outline-btn !min-h-8 !px-2"
                            aria-label={`View ${labels.sessionNoun.toLowerCase()} for ${row.name}`}
                          >
                            <Calendar size={14} aria-hidden />
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          className="appt-pilot-outline-btn !min-h-8 !px-2"
                          aria-label={`Preview ${row.name}`}
                          onClick={() => {
                            const url = bookingUrl();
                            if (url) window.open(url, "_blank");
                          }}
                        >
                          <ExternalLink size={14} aria-hidden />
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
                                onClick={() => { setOpenMenuId(null); void duplicateRow(row); }}
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
