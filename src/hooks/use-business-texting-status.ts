"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { BusinessTextingCampaignStatus } from "@/lib/mass-texting/business-texting-types";
import { isAppointmentsCampaignsPath } from "@/lib/products/business-texting-routes";

export function useBusinessTextingStatus(
  initial: BusinessTextingCampaignStatus | null | undefined,
): BusinessTextingCampaignStatus | null {
  const pathname = usePathname();
  const [status, setStatus] = useState<BusinessTextingCampaignStatus | null>(initial ?? null);

  useEffect(() => {
    if (initial !== undefined && initial !== null) {
      setStatus(initial);
      return;
    }
    if (!isAppointmentsCampaignsPath(pathname)) return;

    fetch("/api/appointments/business-texting/status")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setStatus(json.data as BusinessTextingCampaignStatus);
      })
      .catch(() => undefined);
  }, [initial, pathname]);

  return status;
}
