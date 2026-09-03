import { Tabs } from "@/components/ui/tabs";
import { DRIP_SECTION_NAV_TABS } from "@/lib/drip-campaigns/routes";

/** SMS-only sub-nav wrapper for all drip campaign routes. */
export function DripSectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Tabs items={[...DRIP_SECTION_NAV_TABS]} />
      {children}
    </div>
  );
}
