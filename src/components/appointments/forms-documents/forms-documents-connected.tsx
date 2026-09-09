"use client";

import { useSearchParams } from "next/navigation";
import { RefDecoPageHeader } from "@/components/appointments/kimi-ui/shared/ref-deco-patterns";
import { ContractsAdminClient } from "@/components/appointments/contracts-admin-client";
import { IntakeFormsSection } from "./intake-forms-section";
import { TermsSection } from "./terms-section";
import "@/components/appointments/kimi-ui/overview/reference.css";

type Tab = "intake" | "contracts" | "terms";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "intake", label: "Intake Forms" },
  { id: "contracts", label: "Contract Templates" },
  { id: "terms", label: "Terms" },
];

export function FormsDocumentsConnected() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "intake";

  function tabHref(tab: Tab) {
    return `/appointments/forms-documents?tab=${tab}`;
  }

  return (
    <div className="appt-overview-pilot min-h-screen bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <RefDecoPageHeader
          title="Forms & Documents"
          description="Intake forms, contracts, and terms customers complete or accept when booking."
        />

        <nav className="flex flex-wrap gap-2 mb-6 border-b border-[#ecedf2] pb-3" aria-label="Forms and documents sections">
          {TABS.map((tab) => (
            <a
              key={tab.id}
              href={tabHref(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${
                activeTab === tab.id
                  ? "bg-white border shadow-sm text-[#1a1d29]"
                  : "text-[#8a8fa3] hover:text-[#1a1d29]"
              }`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </a>
          ))}
        </nav>

        {activeTab === "intake" ? <IntakeFormsSection /> : null}
        {activeTab === "contracts" ? (
          <div className="rounded-xl border bg-white p-4">
            <ContractsAdminClient />
          </div>
        ) : null}
        {activeTab === "terms" ? <TermsSection /> : null}
      </div>
    </div>
  );
}
