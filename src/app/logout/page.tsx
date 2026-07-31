"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Clears session via API and redirects to login (handles direct /logout navigation). */
export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST" })
      .finally(() => {
        router.replace("/login");
        router.refresh();
      });
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      Signing out…
    </div>
  );
}
