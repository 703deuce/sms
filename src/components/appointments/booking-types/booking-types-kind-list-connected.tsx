"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Plus } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import {
  segmentById,
  typeBelongsToSegment,
  type ApiTypeRow,
  type BookingTypesSegmentId,
} from "@/lib/appointments/booking-types-segments";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Props = {
  segmentId: BookingTypesSegmentId;
};

function createLabelForSegment(segmentId: BookingTypesSegmentId, title: string): string {
  if (segmentId === "workshops") return "Create workshop or event";
  return `Create ${title.toLowerCase().replace(/s$/, "")}`;
}

function emptyTitleForSegment(segmentId: BookingTypesSegmentId): string {
  switch (segmentId) {
    case "meetings":
      return "Create your first meeting";
    case "services":
      return "Create your first service";
    case "classes":
      return "Create your first class";
    case "workshops":
      return "Create your first workshop or event";
  }
}

export function BookingTypesKindListConnected({ segmentId }: Props) {
  const segment = segmentById(segmentId);
  const [rows, setRows] = useState<ApiTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/appointments/types");
      if (!res.ok) throw new Error("types failed");
      const json = await res.json();
      setRows((json.data || []) as ApiTypeRow[]);
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

  const activeCount = filtered.filter((r) => r.config?.enabled !== false && r.active !== false).length;
  const createLabel = createLabelForSegment(segmentId, segment.title);

  if (loading) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="mt-6 h-64 rounded-xl border border-[var(--border)] bg-white" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12">
          <AlertTriangle className="mx-auto h-5 w-5 text-[var(--brand-accent)]" />
          <p className="mt-3 appt-pilot-text-section">Could not load {segment.title.toLowerCase()}</p>
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
        title={segment.title}
        description={segment.description}
        action={
          <Link href={segment.createHref} className="appt-pilot-primary-btn">
            <Plus size={15} strokeWidth={2.5} aria-hidden />
            {createLabel}
          </Link>
        }
      />

      {filtered.length === 0 ? (
        <div className="appt-pilot-empty-state">
          <h2 className="appt-pilot-text-section">{emptyTitleForSegment(segmentId)}</h2>
          <p className="mx-auto mt-2 max-w-md appt-pilot-text-body text-[var(--text-secondary)]">{segment.description}</p>
          <Link href={segment.createHref} className="appt-pilot-primary-btn mt-5">
            {createLabel}
          </Link>
        </div>
      ) : (
        <div className="appt-pilot-data-table-wrap">
          <div className="appt-pilot-data-table-meta">
            {activeCount} active · {filtered.length} total
          </div>
          <table className="appt-pilot-data-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Duration</th>
                <th scope="col">Status</th>
                <th scope="col" className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const duration = row.durationMinutes;
                const active = row.config?.enabled !== false && row.active !== false;
                return (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{duration ? `${duration} min` : "—"}</td>
                    <td>
                      <span className={active ? "appt-pilot-status-active" : "appt-pilot-status-inactive"}>
                        {active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/appointments/types/editor?id=${encodeURIComponent(row.id)}`}
                        className="appt-pilot-muted-link"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 appt-pilot-text-helper">
        Transitional list — focused {segment.title.toLowerCase()} editor ships in the next batch.
      </p>
    </div>
  );
}
