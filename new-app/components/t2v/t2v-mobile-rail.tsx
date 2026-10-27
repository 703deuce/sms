'use client'

import { T2vRail, type T2vRailTab } from '@/components/t2v/t2v-rail'

/** Bottom tab bar for studio viewports &lt;1024px (§3.0). */
export function T2vMobileRail({
  active,
  onSelect,
}: {
  active: T2vRailTab
  onSelect: (t: T2vRailTab) => void
}) {
  return (
    <div className="shrink-0 border-t border-border bg-background lg:hidden">
      <T2vRail variant="horizontal" active={active} onSelect={onSelect} />
    </div>
  )
}
