"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const segmentId = parseSegment(searchParams.get("segment"));
  const initialTypeId = searchParams.get("id");
  const initialCreate = searchParams.get("create") === "1";

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
