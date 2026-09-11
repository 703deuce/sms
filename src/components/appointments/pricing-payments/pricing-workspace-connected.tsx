"use client";

import { AlertTriangle } from "lucide-react";
import { usePricingPaymentsWorkspace } from "@/features/appointments/kimi/pricing-payments/use-pricing-payments-workspace";
import { PricingHeader } from "./pricing-header";
import { PricingLocalNav } from "./pricing-local-nav";
import { PricingOverviewSection } from "./pricing-overview-section";
import { PricingCollectionSection } from "./pricing-collection-section";
import { PricingDepositsSection } from "./pricing-deposits-section";
import { PricingPackagesSection } from "./pricing-packages-section";
import { PricingDiscountsSection } from "./pricing-discounts-section";
import { PricingRefundsSection } from "./pricing-refunds-section";
import { PricingProvidersSection } from "./pricing-providers-section";
import { PricingCheckoutPreview } from "./pricing-checkout-preview";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

export function PricingPaymentsWorkspaceConnected() {
  const ws = usePricingPaymentsWorkspace();

  const offeringsWithPackages = ws.offeringRows.filter((r) => r.accessLabel.includes("Packages")).length;
  const offeringsWithMemberships = ws.offeringRows.filter((r) => r.accessLabel.includes("Membership")).length;

  async function resetOfferingToDefault(typeId: string) {
    await ws.updateOfferingPayment(typeId, undefined);
    await ws.load();
  }

  if (ws.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] animate-pulse space-y-4">
          <div className="h-10 w-72 rounded bg-[var(--surface)]" />
          <div className="h-12 rounded bg-[var(--surface)]" />
          <div className="h-96 rounded bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  if (ws.failed) {
    return (
      <div className={`${SHELL} flex min-h-full items-center justify-center bg-[var(--surface-muted)] p-8`}>
        <div className="max-w-md rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[var(--accent)]" />
          <p className="font-semibold">Could not load pricing settings</p>
          <button type="button" className="appt-pilot-primary-btn mt-4" onClick={() => void ws.load()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col">
        <PricingHeader
          saving={ws.saving}
          saved={ws.saved}
          error={ws.error}
          onSave={() => void ws.saveSettings()}
          onPreviewCheckout={() => ws.setSection("checkout")}
        />
        <PricingLocalNav active={ws.section} onChange={ws.setSection} attention={ws.attention} />
        <div className="px-4 py-4 lg:px-6">
          {ws.section === "overview" ? (
            <PricingOverviewSection
              stats={ws.stats}
              connections={ws.connections}
              defaults={ws.commerceDefaults}
              previewOffering={ws.previewOffering}
              onNavigate={ws.setSection}
            />
          ) : null}
          {ws.section === "collection" ? (
            <PricingCollectionSection
              defaults={ws.commerceDefaults}
              rows={ws.offeringRows}
              onPatchDefaults={ws.patchDefaults}
              onResetOfferingToDefault={resetOfferingToDefault}
            />
          ) : null}
          {ws.section === "deposits" ? (
            <PricingDepositsSection
              defaults={ws.commerceDefaults}
              rows={ws.offeringRows}
              onPatch={ws.patchDefaults}
            />
          ) : null}
          {ws.section === "packages" ? (
            <PricingPackagesSection
              packageCount={ws.stats.packageCount}
              membershipCount={ws.stats.membershipCount}
              offeringsWithPackages={offeringsWithPackages}
              offeringsWithMemberships={offeringsWithMemberships}
            />
          ) : null}
          {ws.section === "discounts" ? (
            <PricingDiscountsSection
              couponCount={ws.stats.couponCount}
              defaults={ws.commerceDefaults}
              onPatch={ws.patchDefaults}
            />
          ) : null}
          {ws.section === "refunds" ? (
            <PricingRefundsSection />
          ) : null}
          {ws.section === "providers" ? (
            <PricingProvidersSection connections={ws.connections} />
          ) : null}
          {ws.section === "checkout" ? (
            <div className="grid gap-4 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <label className="ws-field-label mb-2 block">Preview offering</label>
                <select
                  className="input w-full"
                  value={ws.previewOfferingId}
                  onChange={(e) => ws.setPreviewOfferingId(e.target.value)}
                >
                  {ws.offeringRows.map((row) => (
                    <option key={row.id} value={row.id}>{row.name}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-8">
                <PricingCheckoutPreview
                  offering={ws.previewOffering}
                  defaults={ws.commerceDefaults}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
