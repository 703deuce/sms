"use client";

import { usePathname } from "next/navigation";
import {
  campaignsPath,
  resolveCampaignsBasePath,
} from "@/lib/products/business-texting-routes";

export function useCampaignsBasePath(): string {
  const pathname = usePathname();
  return resolveCampaignsBasePath(pathname);
}

export function useCampaignsPath(suffix = ""): string {
  const base = useCampaignsBasePath();
  return campaignsPath(suffix, base);
}
