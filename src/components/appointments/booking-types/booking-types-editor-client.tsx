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
    <div className="min-h-full">
      <div className="border-b border-[#ecedf2] bg-white px-6 py-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5b4bff] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b4bff]"
        >
          <ArrowLeft size={14} aria-hidden />
          {backLabel}
        </Link>
        <p className="mt-1 text-[12px] text-[#8a8fa3]">
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
