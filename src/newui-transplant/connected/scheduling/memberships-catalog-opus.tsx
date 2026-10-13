'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CreditCard, MoreHorizontal, Plus } from 'lucide-react'
import {
  accessLabelFromBenefits,
  formatBillingInterval,
  formatMoney,
} from '@/lib/appointments/memberships/membership-form'
import { useMembershipsCatalog } from '@/lib/appointments/memberships/use-memberships-catalog'
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

export function MembershipsCatalogOpus() {
  const catalog = useMembershipsCatalog()
  const [menuId, setMenuId] = useState<string | null>(null)

  return (
    <ArOpusPage>
      <PageHeader
        title="Memberships"
        description="Recurring plans, member benefits, and billing intervals."
        actions={
          <Button asChild>
            <Link href="/appointments/memberships/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New membership
            </Link>
          </Button>
        }
        meta={
          catalog.stats ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral" dot={false}>{catalog.stats.activeMemberships} plans</Pill>
              <Pill tone="neutral" dot={false}>{catalog.stats.activeMembers} members</Pill>
              {catalog.stats.monthlyRecurringRevenueCents > 0 ? (
                <Pill tone="neutral" dot={false}>
                  MRR {formatMoney(catalog.stats.monthlyRecurringRevenueCents)}
                </Pill>
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <OpusSearchField
          id="memberships-search"
          label="Search memberships"
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
            <span className="sr-only">Billing interval</span>
            <select
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              value={catalog.intervalFilter}
              onChange={(e) =>
                catalog.setIntervalFilter(e.target.value as typeof catalog.intervalFilter)
              }
            >
              <option value="all">All intervals</option>
              <option value="month">Monthly</option>
              <option value="quarter">Quarterly</option>
              <option value="year">Yearly</option>
            </select>
          </label>
        </div>
      </div>

      {catalog.loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
      ) : catalog.failed ? (
        <Callout tone="error" title="Could not load memberships">
          <Button type="button" variant="outline" size="sm" onClick={() => void catalog.reload()}>
            Retry
          </Button>
        </Callout>
      ) : catalog.filtered.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No memberships yet"
          description="Offer recurring access with benefits customers use at booking time."
          action={
            <Button asChild>
              <Link href="/appointments/memberships/new">Create membership</Link>
            </Button>
          }
        />
      ) : (
        <OpusDataSurface>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Membership</th>
                <th scope="col" className="px-4 py-3 font-medium">Price</th>
                <th scope="col" className="px-4 py-3 font-medium">Interval</th>
                <th scope="col" className="px-4 py-3 font-medium">Benefits</th>
                <th scope="col" className="px-4 py-3 font-medium">Members</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {catalog.filtered.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <th scope="row" className="px-4 py-3 font-normal">
                    <Link
                      href={`/appointments/memberships/${row.id}`}
                      className="font-medium text-primary"
                    >
                      {row.name}
                    </Link>
                  </th>
                  <td className="px-4 py-3">{formatMoney(row.priceCents)}</td>
                  <td className="px-4 py-3">{formatBillingInterval(row.billingInterval)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {accessLabelFromBenefits(row.benefits)}
                  </td>
                  <td className="px-4 py-3">{row.memberCount ?? 0}</td>
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
                        <DropdownMenuItem render={<Link href={`/appointments/memberships/${row.id}`}>Edit</Link>} />
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
              ))}
            </tbody>
          </table>
        </OpusDataSurface>
      )}
    </ArOpusPage>
  )
}
