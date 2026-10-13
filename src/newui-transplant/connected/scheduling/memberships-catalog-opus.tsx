'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CreditCard, MoreHorizontal, Plus, Users } from 'lucide-react'
import {
  accessLabelFromBenefits,
  formatBillingInterval,
  formatMoney,
} from '@/lib/appointments/memberships/membership-form'
import { useMembershipsCatalog } from '@/lib/appointments/memberships/use-memberships-catalog'
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

export function MembershipsCatalogOpus() {
  const catalog = useMembershipsCatalog()
  const [menuId, setMenuId] = useState<string | null>(null)

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={CreditCard}
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
      />

      {catalog.stats ? (
        <OpusMetricBand>
          <ArStatGrid>
            <Stat label="Active plans" value={String(catalog.stats.activeMemberships)} icon={CreditCard} />
            <Stat label="Members" value={String(catalog.stats.activeMembers)} icon={Users} />
            {catalog.stats.monthlyRecurringRevenueCents > 0 ? (
              <Stat
                label="MRR"
                value={formatMoney(catalog.stats.monthlyRecurringRevenueCents)}
                icon={CreditCard}
              />
            ) : null}
          </ArStatGrid>
        </OpusMetricBand>
      ) : null}

      <OpusListControls>
        <OpusSearchField
          id="memberships-search"
          label="Search memberships"
          placeholder="Search name or description"
          value={catalog.search}
          onChange={catalog.setSearch}
          className="w-full min-w-[220px] sm:max-w-md"
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
            <span className="sr-only">Billing interval</span>
            <select
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
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
      </OpusListControls>

      {catalog.loading ? (
        <OpusDataSurface>
          <OpusTableSkeleton label="Loading memberships" />
        </OpusDataSurface>
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
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={OpusTh}>Membership</th>
                <th scope="col" className={OpusTh}>Price</th>
                <th scope="col" className={OpusTh}>Interval</th>
                <th scope="col" className={OpusTh}>Benefits</th>
                <th scope="col" className={OpusTh}>Members</th>
                <th scope="col" className={OpusTh}>Status</th>
                <th scope="col" className={cn(OpusTh, 'text-right')}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {catalog.filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <th scope="row" className={cn(OpusTd, 'font-normal')}>
                    <Link
                      href={`/appointments/memberships/${row.id}`}
                      className="font-medium text-primary"
                    >
                      {row.name}
                    </Link>
                  </th>
                  <td className={OpusTd}>{formatMoney(row.priceCents)}</td>
                  <td className={OpusTd}>{formatBillingInterval(row.billingInterval)}</td>
                  <td className={cn(OpusTd, 'text-muted-foreground')}>
                    {accessLabelFromBenefits(row.benefits)}
                  </td>
                  <td className={OpusTd}>{row.memberCount ?? 0}</td>
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
          </div>
        </OpusDataSurface>
      )}
    </ArOpusPage>
  )
}
