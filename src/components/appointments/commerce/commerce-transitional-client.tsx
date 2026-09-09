"use client";

import Link from "next/link";
import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";

export function CommerceTransitionalClient() {
  return (
    <div className="appt-overview-pilot ref-root min-h-full">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-6 py-3">
        <p className="appt-pilot-text-helper">
          This page is transitional. Use focused destinations:{" "}
          <Link href="/appointments/packages" className="appt-pilot-muted-link">Packages</Link>
          {" · "}
          <Link href="/appointments/memberships" className="appt-pilot-muted-link">Memberships</Link>
          {" · "}
          <Link href="/appointments/products-offers" className="appt-pilot-muted-link">Products & Offers</Link>
        </p>
      </div>
      <ServiceBookingAdminClient initialSection="packages" title="Commerce (transitional)" />
    </div>
  );
}
