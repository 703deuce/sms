import Link from "next/link";
import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export default function BookingTypesEventsPage() {
  return (
    <div className="min-h-full bg-[#f7f8fb]">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-[#1a1d29]">Workshops & events</h1>
            <p className="text-sm text-[#8a8fa3] mt-1">
              Fixed-date registrations and multi-session programs customers can book.
            </p>
          </div>
          <Link
            href="/appointments/calendar"
            className="text-sm font-medium text-[#5b4bff] hover:underline"
          >
            View calendar →
          </Link>
        </div>
      </div>
      <ServiceBookingAdminClient initialSection="programs" title="Workshops & events" />
    </div>
  );
}
