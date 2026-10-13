'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Layers, MoreHorizontal, Package, Plus } from 'lucide-react'
import {
  eligibilitySummary,
  formatMoney,
  type PackageProductApiRow,
} from '@/lib/appointments/packages/package-form'
import type { PackageCreditRule } from '@/lib/appointments/service-booking/types'
import {
  packageCreditsTotal,
  usePackagesCatalog,
} from '@/lib/appointments/packages/use-packages-catalog'
import {
  ArOpusPage,
  ArStatGrid,
  OpusDataSurface,
  OpusSearchField,
  OpusTableSkeleton,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusListControls,
  OpusMetricBand,
  OpusSchedulingHero,
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Button } from '@/newui-transplant/components/ui/button'
import { Callout, EmptyState, Pill, Stat } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'

function eligibleLabel(rules: PackageCreditRule[]): string {
  const summary = eligibilitySummary(rules)
  const parts: string[] = []
  if (summary.services) parts.push(`${summary.services} Service${summary.services === 1 ? '' : 's'}`)
  if (summary.meetings) parts.push(`${summary.meetings} Meeting${summary.meetings === 1 ? '' : 's'}`)
  if (summary.classes) parts.push(`${summary.classes} Class${summary.classes === 1 ? '' : 'es'}`)
  if (summary.workshops) parts.push(`${summary.workshops} Workshop${summary.workshops === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' · ') : 'None yet'
}

export function PackagesCatalogOpus() {
  const catalog = usePackagesCatalog()
  const [menuId, setMenuId] = useState<string | null>(null)

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={Package}
        title="Packages"
        description="Sell prepaid bundles of bookings and manage customer credits."
        actions={
          <Button asChild>
            <Link href="/appointments/packages/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Create package
            </Link>
          </Button>
        }
      />

      {catalog.stats ? (
        <OpusMetricBand>
          <ArStatGrid>
            <Stat label="Active packages" value={String(catalog.stats.activePackages)} icon={Package} />
            <Stat label="Sold" value={String(catalog.stats.customerPackages)} icon={Layers} />
            <Stat label="Credits available" value={String(catalog.stats.availableCredits)} icon={Layers} />
          </ArStatGrid>
        </OpusMetricBand>
      ) : null}

      <OpusListControls>
        <OpusSearchField
          id="packages-search"
          label="Search packages"
          placeholder="Search name or description"
          value={catalog.search}
          onChange={catalog.setSearch}
          className="w-full min-w-[280px] sm:max-w-[320px]"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={catalog.statusFilter}
            onValueChange={(v) => catalog.setStatusFilter(v as typeof catalog.statusFilter)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="text-sm text-muted-foreground">
            <span className="sr-only">Sort</span>
            <select
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
              value={catalog.sort}
              onChange={(e) => catalog.setSort(e.target.value as typeof catalog.sort)}
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
      </OpusListControls>

      {catalog.loading ? (
        <OpusDataSurface>
          <OpusTableSkeleton label="Loading packages" />
        </OpusDataSurface>
      ) : catalog.failed ? (
        <Callout tone="error" title="Could not load packages">
          <Button type="button" variant="outline" size="sm" onClick={() => void catalog.reload()}>
            Retry
          </Button>
        </Callout>
      ) : catalog.filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No packages yet"
          description="Sell prepaid bundles customers can redeem for eligible bookings."
          action={
            <Button asChild>
              <Link href="/appointments/packages/new">Create package</Link>
            </Button>
          }
        />
      ) : (
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={OpusTh}>Package</th>
                <th scope="col" className={OpusTh}>Credits</th>
                <th scope="col" className={OpusTh}>Price</th>
                <th scope="col" className={OpusTh}>Eligible</th>
                <th scope="col" className={OpusTh}>Customers</th>
                <th scope="col" className={OpusTh}>Status</th>
                <th scope="col" className={cn(OpusTh, 'text-right')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {catalog.filtered.map((row) => {
                const rules = (row.creditRules || []) as PackageCreditRule[]
                const credits = packageCreditsTotal(rules)
                return (
                  <tr key={row.id} className="min-h-[4.5rem] hover:bg-muted/40">
                    <th scope="row" className={cn(OpusTd, 'font-normal')}>
                      <Link href={`/appointments/packages/${row.id}`} className="flex items-center gap-2 font-medium text-primary">
                        <Layers className="h-4 w-4 shrink-0" aria-hidden />
                        <span>
                          {row.name}
                          {row.description ? (
                            <span className="block text-xs font-normal text-muted-foreground">{row.description}</span>
                          ) : null}
                        </span>
                      </Link>
                    </th>
                    <td className={OpusTd}>{credits ? `${credits} uses` : '—'}</td>
                    <td className={OpusTd}>{formatMoney(row.priceCents)}</td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>{eligibleLabel(rules)}</td>
                    <td className={OpusTd}>{row.ownerCount ?? 0}</td>
                    <td className={OpusTd}>
                      <Pill tone={row.active ? 'success' : 'neutral'} dot={false}>
                        {row.active ? 'Active' : 'Inactive'}
                      </Pill>
                    </td>
                    <td className={cn(OpusTd, 'text-right')}>
                      <DropdownMenu
                        open={menuId === row.id}
                        onOpenChange={(open) => setMenuId(open ? row.id : null)}
                      >
                        <DropdownMenuTrigger
                          render={
                            <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem render={<Link href={`/appointments/packages/${row.id}`}>Edit</Link>} />
                          <DropdownMenuItem
                            onClick={() => void catalog.duplicateRow(row.id).then(() => setMenuId(null))}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void catalog.toggleActive(row).then(() => setMenuId(null))}
                          >
                            {row.active ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </OpusDataSurface>
      )}
    </ArOpusPage>
  )
}
