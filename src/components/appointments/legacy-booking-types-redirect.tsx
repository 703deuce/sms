"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { canonicalAdminRouteForBookingTypeKind } from "@/lib/appointments/bookable-object-ia";
import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";

/**
 * Legacy `/appointments/types` hub — redirects to canonical object routes.
 * Supports `?id=` deep links by resolving booking type kind from API.
 */
export function LegacyBookingTypesRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeId = searchParams.get("id");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!typeId) {
        router.replace("/appointments/services");
        return;
      }
      try {
        const res = await fetch(`/api/appointments/types/${encodeURIComponent(typeId)}`);
        if (!res.ok) {
          if (!cancelled) router.replace("/appointments/services");
          return;
        }
        const json = await res.json();
        const kind = resolveBookingTypeKind(json.data?.config);
        if (!cancelled) {
          router.replace(`${canonicalAdminRouteForBookingTypeKind(kind)}?id=${encodeURIComponent(typeId)}`);
        }
      } catch {
        if (!cancelled) router.replace("/appointments/services");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, typeId]);

  return (
    <div className="reference-root min-h-[40vh] flex items-center justify-center bg-[#f7f8fa] text-[13px] text-[#8a8fa3]">
      Redirecting…
    </div>
  );
}
