"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, PartyPopper, Users, Video, Wrench } from "lucide-react";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import {
  BOOKING_TYPES_SEGMENTS,
  countActiveInSegment,
  segmentStatusLabel,
  type ApiTypeRow,
} from "@/lib/appointments/booking-types-segments";
import { BookingTypesTypeCard } from "./booking-types-type-card";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SEGMENT_ICONS = {
  meetings: Video,
  services: Wrench,
  classes: Users,
  workshops: PartyPopper,
} as const;

const CREATE_LABELS = {
  meetings: "Create meeting",
  services: "Create service",
  classes: "Create class",
  workshops: "Create workshop or event",
} as const;

const VIEW_LABELS = {
  meetings: "View meetings",
  services: "View services",
  classes: "View classes",
  workshops: "View workshops & events",
} as const;

function LandingLoading() {
  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-8 pt-5 animate-pulse">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-56 rounded-xl border border-[var(--border)] bg-white" />
        ))}
      </div>
    </div>
  );
}

function LandingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
      <div className="max-w-md text-center rounded-xl border border-dashed border-[var(--border)] bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="appt-pilot-text-section">We couldn&apos;t load booking types</h3>
        <p className="mt-1.5 appt-pilot-text-body text-[var(--text-secondary)]">Check your connection and try again.</p>
        <button type="button" className="mt-5 appt-pilot-primary-btn" onClick={onRetry}>Try again</button>
      </div>
    </div>
  );
}

export function BookingTypesLandingConnected() {
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

  const recent = useMemo(() => {
    return [...rows]
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [rows]);

  if (loading) return <LandingLoading />;
  if (failed) return <LandingError onRetry={load} />;

  const totalActive = BOOKING_TYPES_SEGMENTS.reduce(
    (sum, seg) => sum + countActiveInSegment(rows, seg.id),
    0,
  );

  return (
    <div className="appt-overview-pilot ref-root min-h-full px-6 pb-10 pt-5">
      <RefDecoPageHeader
        title="Booking Types"
        description="Choose what customers can schedule with your business."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Booking type categories">
        {BOOKING_TYPES_SEGMENTS.map((segment, index) => {
          const count = countActiveInSegment(rows, segment.id);
          const Icon = SEGMENT_ICONS[segment.id];
          return (
            <div key={segment.id} role="listitem" className="h-full">
              <BookingTypesTypeCard
                title={segment.title}
                description={segment.description}
                examples={segment.examples}
                statusLabel={segmentStatusLabel(count, segment.id)}
                createHref={segment.createHref}
                listHref={segment.listHref}
                createLabel={CREATE_LABELS[segment.id]}
                viewLabel={VIEW_LABELS[segment.id]}
                icon={Icon}
                accent={index === 0}
              />
            </div>
          );
        })}
      </div>

      {totalActive > 0 && recent.length > 0 ? (
        <section className="ref-deco-section mt-8" aria-labelledby="recent-booking-types-heading">
          <div className="ref-deco-section-head flex items-center justify-between gap-3">
            <h2 id="recent-booking-types-heading">Your booking types</h2>
            <span className="appt-pilot-text-helper">{totalActive} active</span>
          </div>
          <div className="ref-deco-section-body">
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="appt-pilot-text-list font-medium text-[var(--text-primary)] truncate">{row.name}</span>
                  <Link
                    href={`/appointments/types/editor?id=${encodeURIComponent(row.id)}`}
                    className="appt-pilot-muted-link shrink-0"
                  >
                    Manage
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-center appt-pilot-text-helper">
        <CalendarDays className="inline-block mr-1.5 -mt-0.5" size={14} aria-hidden />
        Packages, memberships, and gift cards live under{" "}
        <Link href="/appointments/commerce" className="appt-pilot-muted-link">
          Packages &amp; Sales
        </Link>
        .
      </p>
    </div>
  );
}
