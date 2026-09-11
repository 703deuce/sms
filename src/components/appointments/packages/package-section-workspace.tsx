"use client";

import type { usePackageEditor } from "@/features/appointments/kimi/packages/use-package-editor";
import { PackageActivitySection } from "./package-activity-section";
import { PackageCustomersSection } from "./package-customers-section";
import { PackageEligibilitySection } from "./package-eligibility-section";
import { PackageOverviewSection } from "./package-overview-section";
import { PackagePricingSection } from "./package-pricing-section";
import type { PackageSectionId } from "./package-section-types";

type Editor = ReturnType<typeof usePackageEditor>;

type Props = {
  section: PackageSectionId;
  editor: Editor;
  onNavigate: (section: PackageSectionId) => void;
};

export function PackageSectionWorkspace({ section, editor, onNavigate }: Props) {
  const redeemedCount = editor.activity.filter((row) => row.kind === "redeem").length;

  switch (section) {
    case "overview":
      return (
        <PackageOverviewSection
          form={editor.form}
          ownerStats={editor.ownerStats}
          redeemedCount={redeemedCount}
          eligibleCount={editor.eligibleOfferings.length}
          onFormChange={editor.onFormChange}
          onNavigate={onNavigate}
        />
      );
    case "eligible":
      return (
        <PackageEligibilitySection
          creditRules={editor.creditRules}
          offerings={editor.options.offerings}
          onToggle={editor.toggleOffering}
        />
      );
    case "pricing":
      return <PackagePricingSection form={editor.form} onFormChange={editor.onFormChange} />;
    case "customers":
      return (
        <PackageCustomersSection
          balances={editor.balances}
          ownerStats={editor.ownerStats}
          onAdjustCredits={editor.adjustCredits}
        />
      );
    case "activity":
      return <PackageActivitySection activity={editor.activity} />;
    default:
      return null;
  }
}
