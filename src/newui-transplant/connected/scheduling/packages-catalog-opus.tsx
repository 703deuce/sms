'use client'

import { PackagesCatalogConnected } from '@/components/appointments/packages/packages-catalog-connected'
import { SchedulingOpusEmbed } from '@/newui-transplant/connected/scheduling/scheduling-opus-embed'
import { SchedulingOpusShell } from '@/newui-transplant/connected/scheduling/scheduling-opus-shell'

export function PackagesCatalogOpus() {
  return (
    <SchedulingOpusShell
      title="Packages"
      description="Sell prepaid bundles of bookings and manage customer credits."
    >
      <SchedulingOpusEmbed>
        <PackagesCatalogConnected />
      </SchedulingOpusEmbed>
    </SchedulingOpusShell>
  )
}
