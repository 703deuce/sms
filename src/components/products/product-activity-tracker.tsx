"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getCurrentProduct } from "@/lib/products/context";

/** Updates lastActiveProduct when user navigates within a product app. */
export function ProductActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const product = getCurrentProduct(pathname);
    if (!product) return;
    fetch("/api/products/last-active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
