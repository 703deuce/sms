'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MoreHorizontal, Package, Plus } from 'lucide-react'
import {
  formatMoney,
  packageBenefitsSummary,
  packageFormFromRow,
} from '@/lib/appointments/packages/package-form'
import type { PackageCreditRule } from '@/lib/appointments/service-booking/types'
import {
  usePackagesCatalog,
} from '@/lib/appointments/packages/use-packages-catalog'
import {
  ArOpusPage,
  OpusDataSurface,
  OpusSearchField,
  OpusTableSkeleton,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusListControls,
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { SchedulingPageHeader } from '@/components/appointments/scheduling-opus/scheduling-page-header'
import { OfferingCatalogProductCell } from '@/components/appointments/scheduling-opus/offering-catalog-product-cell'
import { Button } from '@/newui-transplant/components/ui/button'
import { Callout, EmptyState, Pill } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'

export function PackagesCatalogOpus() {
  const catalog = usePackagesCatalog()
  const [menuId, setMenuId] = useState<string | null>(null)

  return (
    <ArOpusPage>
      <SchedulingPageHeader
        icon={Package}
        title="Packages"
        description="Create and manage prepaid packages and bundles."
        actions={
          <Button nativeButton={false} render={<Link href="/appointments/packages/new" />}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Create package
          </Button>
        }
      />

      <OpusListControls className="mt-5 min-h-[3.25rem]">
        <OpusSearchField
          id="packages-search"
          label="Search packages"
          placeholder="Search name or description"
          value={catalog.search}
          onChange={catalog.setSearch}
          className="h-10 w-full min-w-[280px] sm:max-w-[320px]"
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
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
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
        <OpusDataSurface className="mt-3">
          <OpusTableSkeleton label="Loading packages" />
        </OpusDataSurface>
      ) : catalog.failed ? (
        <Callout tone="warning" title="Could not load packages" className="mt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => void catalog.reload()}>
            Retry
          </Button>
        </Callout>
      ) : catalog.filtered.length === 0 ? (
        <OpusDataSurface className="mt-3 flex min-h-[13.75rem] items-center justify-center p-6">
          <EmptyState
            icon={Package}
            title="No packages yet"
            description="Sell prepaid bundles customers can redeem for eligible bookings."
            action={
              <Button nativeButton={false} render={<Link href="/appointments/packages/new" />}>Create package</Button>
            }
          />
        </OpusDataSurface>
      ) : (
        <OpusDataSurface className="mt-3 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={cn(OpusTh, 'w-[34%]')}>Package</th>
                  <th scope="col" className={cn(OpusTh, 'w-[23%]')}>Included benefits</th>
                  <th scope="col" className={OpusTh}>Price</th>
                  <th scope="col" className={OpusTh}>Purchases</th>
                  <th scope="col" className={OpusTh}>Status</th>
                  <th scope="col" className={cn(OpusTh, 'text-right')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {catalog.filtered.map((row) => {
                  const rules = (row.creditRules || []) as PackageCreditRule[]
                  const parsed = packageFormFromRow(row)
                  return (
                    <tr key={row.id} className="min-h-[4.5rem] hover:bg-muted/40">
                      <th scope="row" className={cn(OpusTd, 'py-3 font-normal')}>
                        <OfferingCatalogProductCell
                          href={`/appointments/packages/${row.id}`}
                          name={row.name}
                          description={row.description}
                          imageUrl={parsed.imageUrl}
                          category="package"
                        />
                      </th>
                      <td className={cn(OpusTd, 'max-w-[16rem] text-muted-foreground')}>
                        <span className="line-clamp-2 text-sm">{packageBenefitsSummary(rules, { active: row.active })}</span>
                      </td>
                      <td className={cn(OpusTd, 'font-medium tabular-nums')}>{formatMoney(row.priceCents)}</td>
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
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-[2.125rem]"
                                aria-label={`Actions for ${row.name}`}
                              >
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
