"use client";

import { useState } from "react";
import { ServiceBookingAdminClient } from "@/components/appointments/service-booking-admin-client";
import { ContractsAdminClient } from "@/components/appointments/contracts-admin-client";

type Tab = "intake" | "contracts" | "terms";

const TABS: Array<{ id: Tab; label: string; description: string }> = [
  { id: "intake", label: "Intake forms", description: "Questions and file uploads collected after booking." },
  { id: "contracts", label: "Contracts", description: "Agreements customers sign for selected booking types." },
  { id: "terms", label: "Terms", description: "SMS consent and booking terms versioned for new bookings." },
];

export function FormsDocumentsClient() {
  const [tab, setTab] = useState<Tab>("intake");

  return (
    <div className="min-h-full bg-[#f7f8fa]">
      <div className="max-w-[1100px] mx-auto px-6 pt-6 pb-10">
        <header className="mb-6">
          <h1 className="text-[22px] font-bold text-[#1a1d29]">Forms & documents</h1>
          <p className="text-[13px] text-[#8a8fa3] mt-1">
            Intake forms, contracts, and terms assigned to booking types. Historical accepted versions stay on each appointment.
          </p>
        </header>

        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Forms and documents">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium border transition-colors ${
                tab === t.id
                  ? "bg-white border-[#147d74] text-[#147d74] shadow-sm"
                  : "bg-transparent border-[#ecedf2] text-[#3f4254] hover:bg-white"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="text-[12px] text-[#8a8fa3] mb-4">{TABS.find((t) => t.id === tab)?.description}</p>

        <div className="rounded-xl border border-[#ecedf2] bg-white overflow-hidden">
          {tab === "intake" ? (
            <ServiceBookingAdminClient initialSection="intake" title="Intake forms" embedded />
          ) : null}
          {tab === "contracts" ? <ContractsAdminClient /> : null}
          {tab === "terms" ? (
            <ServiceBookingAdminClient initialSection="terms" title="Terms" embedded />
          ) : null}
        </div>
      </div>
    </div>
  );
}
