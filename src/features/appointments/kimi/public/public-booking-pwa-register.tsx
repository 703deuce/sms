"use client";

import { useEffect } from "react";

export function PublicBookingPwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw-booking.js").catch(() => undefined);
  }, []);
  return null;
}
