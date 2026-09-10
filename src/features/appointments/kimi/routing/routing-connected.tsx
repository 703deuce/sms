"use client";

import Link from "next/link";
import { LegacyRoutingRulesPanel } from "@/components/appointments/legacy-routing-rules-panel";

/** Legacy route shell — canonical editor lives on Booking → Routing. */
export function RoutingConnected() {
  return (
    <div className="min-h-screen bg-[#f7f8fa] p-6 font-sans">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <h1 className="text-2xl font-bold text-[#1a1d29]">Routing</h1>
          <p className="mt-1 text-sm text-[#8a8fa3]">
            Answer-based routing rules are managed on{" "}
            <Link href="/appointments/routing-forms" className="text-primary underline">
              Booking → Routing
            </Link>
            .
          </p>
        </header>
        <LegacyRoutingRulesPanel />
      </div>
    </div>
  );
}
