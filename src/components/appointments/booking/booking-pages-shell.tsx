"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookingConnected } from "@/features/appointments/kimi/booking/booking-connected";
import { BookingShareHubClient } from "@/components/appointments/booking-share-hub-client";
import { BookingBrandingSection } from "./booking-branding-section";
import { BookingAdvancedPanel } from "@/components/appointments/booking-advanced-panel";

type Section = "general" | "branding" | "share" | "confirmation" | "advanced";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "general", label: "General" },
  { id: "branding", label: "Branding" },
  { id: "share", label: "Share & Embed" },
  { id: "confirmation", label: "Confirmation" },
  { id: "advanced", label: "Advanced" },
];

type Props = {
  workspaceSlug: string;
  workspaceName: string;
  types: Array<{ id: string; name: string }>;
};

function BookingPagesShellInner({ workspaceSlug, workspaceName, types }: Props) {
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section") as Section | null;
  const section: Section =
    sectionParam && SECTIONS.some((s) => s.id === sectionParam) ? sectionParam : "general";

  return (
    <div className="min-h-screen bg-[#f7f8fb]">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <nav className="flex flex-wrap gap-2 mb-4 border-b border-[#ecedf2] pb-3" aria-label="Booking page sections">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`/appointments/booking?section=${s.id}`}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                section === s.id
                  ? "bg-white border shadow-sm text-[#1a1d29]"
                  : "text-[#8a8fa3] hover:text-[#1a1d29]"
              }`}
              aria-current={section === s.id ? "page" : undefined}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      {section === "general" ? (
        <BookingConnected workspaceSlug={workspaceSlug} workspaceName={workspaceName} />
      ) : null}

      {section === "branding" ? (
        <div className="max-w-3xl mx-auto px-6 pb-10">
          <BookingBrandingSection />
        </div>
      ) : null}

      {section === "share" ? (
        <div className="max-w-4xl mx-auto px-6 pb-10">
          <BookingShareHubClient
            workspaceSlug={workspaceSlug}
            workspaceName={workspaceName}
            types={types}
          />
        </div>
      ) : null}

      {section === "confirmation" ? (
        <div className="max-w-2xl mx-auto px-6 pb-10">
          <div className="rounded-xl border bg-white p-6 space-y-3">
            <h2 className="text-[15px] font-semibold">Confirmation defaults</h2>
            <p className="text-[13px] text-[#8a8fa3]">
              Workspace-level confirmation messages apply unless a meeting, service, class, or event overrides them.
            </p>
            <p className="text-[13px] text-[#6b6f82]">
              Edit per-type confirmation on each booking type editor. Booking-page defaults are managed in General → business info and SMS consent.
            </p>
          </div>
        </div>
      ) : null}

      {section === "advanced" ? (
        <div className="max-w-2xl mx-auto px-6 pb-10">
          <div className="rounded-xl border bg-white p-6">
            <BookingAdvancedPanel workspaceSlug={workspaceSlug} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BookingPagesShell(props: Props) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
      <BookingPagesShellInner {...props} />
    </Suspense>
  );
}
