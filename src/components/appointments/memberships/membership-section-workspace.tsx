"use client";

import type { useMembershipEditor } from "@/features/appointments/kimi/memberships/use-membership-editor";
import { MembershipAccessSection } from "./membership-access-section";
import { MembershipActivitySection } from "./membership-activity-section";
import { MembershipLifecycleSection } from "./membership-lifecycle-section";
import { MembershipMembersSection } from "./membership-members-section";
import { MembershipOverviewSection } from "./membership-overview-section";
import { MembershipPricingSection } from "./membership-pricing-section";
import type { MembershipSectionId } from "./membership-section-types";

type Editor = ReturnType<typeof useMembershipEditor>;

type Props = {
  section: MembershipSectionId;
  editor: Editor;
  onNavigate: (section: MembershipSectionId) => void;
  renewalsThisMonth: number;
};

export function MembershipSectionWorkspace({ section, editor, onNavigate, renewalsThisMonth }: Props) {
  switch (section) {
    case "overview":
      return (
        <MembershipOverviewSection
          form={editor.form}
          memberStats={editor.memberStats}
          renewalsThisMonth={renewalsThisMonth}
          onFormChange={editor.onFormChange}
          onNavigate={onNavigate}
        />
      );
    case "access":
      return (
        <MembershipAccessSection
          benefits={editor.benefits}
          offerings={editor.options.offerings}
          onToggle={editor.toggleOffering}
        />
      );
    case "pricing":
      return (
        <MembershipPricingSection form={editor.form} onFormChange={editor.onFormChange} />
      );
    case "members":
      return (
        <MembershipMembersSection
          subscriptions={editor.subscriptions}
          memberStats={editor.memberStats}
          onSubscriptionAction={editor.subscriptionAction}
        />
      );
    case "lifecycle":
      return (
        <MembershipLifecycleSection form={editor.form} onFormChange={editor.onFormChange} />
      );
    case "activity":
      return <MembershipActivitySection activity={editor.activity} />;
    default:
      return null;
  }
}
