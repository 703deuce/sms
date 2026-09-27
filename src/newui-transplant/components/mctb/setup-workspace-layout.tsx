"use client";

import { LinkTabs } from "@/newui-transplant/components/app/link-tabs";
import { MCTB_SETUP_SECTIONS } from "@/newui-transplant/lib/nav";

const SETUP_SECTION_DESCRIPTIONS: Record<string, string> = {
  "/mctb/setup": "Setup status and section shortcuts",
  "/mctb/setup/phone": "Business line, forwarding, and messaging sender",
  "/mctb/setup/consent": "How permission to text is established",
  "/mctb/setup/text-back": "First recovery message and delivery timing",
  "/mctb/setup/recovery": "Pause, triggers, cooldown, and duplicate protection",
  "/mctb/setup/voicemail": "Voicemail greeting and behavior",
  "/mctb/setup/notifications": "Team email alerts for recovery events",
  "/mctb/setup/exclusions": "Numbers that should not receive recovery texts",
  "/mctb/setup/links": "Request form and shared customer links",
  "/mctb/setup/test": "Verify forwarding and recovery",
};

/** Shared setup section tabs only — section page bodies remain unchanged (frozen). */
export function MctbSetupWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const tabs = MCTB_SETUP_SECTIONS.map((t) => ({
    label: t.label,
    href: t.href,
    title: SETUP_SECTION_DESCRIPTIONS[t.href],
  }));

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-2 md:px-8">
        <LinkTabs tabs={tabs} label="Setup sections" />
      </div>
      {children}
    </>
  );
}
