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
import { ArOpusPage, OpusDataSurface, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Button } from '@/newui-transplant/components/ui/button'
import { Callout, EmptyState, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
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
      <PageHeader
        title="Packages"
        description="Sell prepaid bundles of bookings and manage customer credits."
        actions={
          <Button asChild>
            <Link href="/appointments/packages/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New package
            </Link>
          </Button>
        }
        meta={
          catalog.stats ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral" dot={false}>{catalog.stats.activePackages} active</Pill>
              <Pill tone="neutral" dot={false}>{catalog.stats.customerPackages} sold</Pill>
              <Pill tone="neutral" dot={false}>{catalog.stats.availableCredits} credits</Pill>
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <OpusSearchField
          id="packages-search"
          label="Search packages"
          placeholder="Search name or description"
          value={catalog.search}
          onChange={catalog.setSearch}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={catalog.statusFilter}
            onValueChange={(v) => catalog.setStatusFilter(v as typeof catalog.statusFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
            </TabsList>
          </Tabs>
          <label className="text-sm text-muted-foreground">
            <span className="sr-only">Sort</span>
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={catalog.sort}
              onChange={(e) => catalog.setSort(e.target.value as typeof catalog.sort)}
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>
      </div>

      {catalog.loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
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
        <OpusDataSurface>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Package</th>
                <th scope="col" className="px-4 py-3 font-medium">Credits</th>
                <th scope="col" className="px-4 py-3 font-medium">Price</th>
                <th scope="col" className="px-4 py-3 font-medium">Eligible</th>
                <th scope="col" className="px-4 py-3 font-medium">Customers</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.filtered.map((row) => {
                const rules = (row.creditRules || []) as PackageCreditRule[]
                const credits = packageCreditsTotal(rules)
                return (
                  <tr key={row.id} className="border-b last:border-0">
                    <th scope="row" className="px-4 py-3 font-normal">
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
                    <td className="px-4 py-3">{credits ? `${credits} uses` : '—'}</td>
                    <td className="px-4 py-3">{formatMoney(row.priceCents)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{eligibleLabel(rules)}</td>
                    <td className="px-4 py-3">{row.ownerCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <Pill tone={row.active ? 'success' : 'neutral'} dot={false}>
                        {row.active ? 'Active' : 'Inactive'}
                      </Pill>
                    </td>
                    <td className="px-4 py-3 text-right">
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
        </OpusDataSurface>
      )}
    </ArOpusPage>
  )
}
