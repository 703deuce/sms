"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppointmentTypesConnected } from "@/features/appointments/kimi/appointment-types/appointment-types-connected";
import type { BookingTypesSegmentId } from "@/lib/appointments/booking-types-segments";
import { segmentById } from "@/lib/appointments/booking-types-segments";

const SEGMENT_IDS = new Set<BookingTypesSegmentId>(["meetings", "services", "classes", "workshops"]);

function parseSegment(raw: string | null): BookingTypesSegmentId | undefined {
  if (!raw || !SEGMENT_IDS.has(raw as BookingTypesSegmentId)) return undefined;
  return raw as BookingTypesSegmentId;
}

export function BookingTypesEditorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const segmentId = parseSegment(searchParams.get("segment"));
  const initialTypeId = searchParams.get("id");
  const initialCreate = searchParams.get("create") === "1";

  useEffect(() => {
    if (segmentId === "meetings") {
      if (initialCreate) {
        router.replace("/appointments/types/meetings/new");
        return;
      }
      if (initialTypeId) {
        router.replace(`/appointments/types/meetings/${encodeURIComponent(initialTypeId)}`);
      }
      return;
    }
    if (segmentId === "services") {
      if (initialCreate) {
        router.replace("/appointments/types/services/new");
        return;
      }
      if (initialTypeId) {
        router.replace(`/appointments/types/services/${encodeURIComponent(initialTypeId)}`);
      }
    }
  }, [initialCreate, initialTypeId, router, segmentId]);

  if (segmentId === "meetings" || segmentId === "services") {
    return (
      <div className="appt-overview-pilot ref-root min-h-full px-6 py-12 flex items-center justify-center">
        <p className="appt-pilot-text-helper" aria-busy="true">Opening editor…</p>
      </div>
    );
  }

  const backHref = segmentId ? segmentById(segmentId).listHref : "/appointments/types";
  const backLabel = segmentId ? segmentById(segmentId).title : "Booking Types";

  return (
    <div className="appt-overview-pilot min-h-full">
      <div className="appt-pilot-subheader-bar">
        <Link href={backHref} className="appt-pilot-back-link !mb-0">
          <ArrowLeft size={14} aria-hidden />
          {backLabel}
        </Link>
        <p className="mt-1 appt-pilot-text-helper">
          Transitional editor — focused {segmentId ? segmentById(segmentId).title.toLowerCase() : "booking type"} editor ships in the next batch.
        </p>
      </div>
      <AppointmentTypesConnected
        segmentId={segmentId}
        initialTypeId={initialTypeId}
        initialCreate={initialCreate}
      />
    </div>
  );
}
