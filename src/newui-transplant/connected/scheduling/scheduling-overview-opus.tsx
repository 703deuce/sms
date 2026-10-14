'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  CalendarDays,
  ExternalLink,
  GraduationCap,
  Package,
  Plus,
  TrendingUp,
} from 'lucide-react'
import {
  ArOpusPage,
  OpusDataSurface,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { SchedulingPageHeader } from '@/components/appointments/scheduling-opus/scheduling-page-header'
import { SchedulingCompactEmpty } from '@/components/appointments/scheduling-opus/scheduling-compact-empty'
import { StorefrontReadinessPanel } from '@/components/appointments/scheduling-opus/storefront-readiness-panel'
import { OfferingCatalogProductCell } from '@/components/appointments/scheduling-opus/offering-catalog-product-cell'
import { Button } from '@/newui-transplant/components/ui/button'
import { EmptyState, Pill } from '@/newui-transplant/components/app/kit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import {
  formatMoney,
  packageFormFromRow,
} from '@/lib/appointments/packages/package-form'
import { cn } from '@/lib/utils'

type Stats = {
  activePackages: number
  customerPackages: number
  packageRevenueCents: number
}

type PackageRow = { id: string; name: string; description?: string | null; priceCents: number; active: boolean; metadata?: unknown }

export function SchedulingOverviewOpus() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const [statsRes, listRes] = await Promise.all([
          fetch('/api/appointments/service-booking/packages?view=stats'),
          fetch('/api/appointments/service-booking/packages'),
        ])
        const statsJson = statsRes.ok ? await statsRes.json() : { data: null }
        const listJson = listRes.ok ? await listRes.json() : { data: [] }
        setStats(statsJson.data)
        setPackages((listJson.data || []).slice(0, 6))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <ArOpusPage>
      <SchedulingPageHeader
        icon={CalendarDays}
        title="Scheduling"
        description="Sell packages, run classes, and keep bookings on track."
        actions={
          <>
            <Button nativeButton={false} render={<Link href="/appointments/sell" />}>
              <Plus className="mr-2 size-4" aria-hidden />
              Create
            </Button>
            <Button nativeButton={false} variant="outline" render={<Link href="/appointments/booking/share" />}>
              <ExternalLink className="mr-2 size-4" aria-hidden />
              Booking page
            </Button>
          </>
        }
      />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Package revenue',
            value: loading ? '—' : formatMoney(stats?.packageRevenueCents ?? 0),
            icon: TrendingUp,
          },
          {
            label: 'Package owners',
            value: loading ? '—' : String(stats?.customerPackages ?? 0),
            icon: Package,
          },
          {
            label: 'Active packages',
            value: loading ? '—' : String(stats?.activePackages ?? 0),
            icon: Package,
          },
          {
            label: 'Class enrollments',
            value: '—',
            icon: GraduationCap,
            hint: 'Open classes for live counts',
          },
        ].map((m) => (
          <div
            key={m.label}
            className="flex h-[6.75rem] flex-col rounded-xl border bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
              <m.icon className="size-4 text-primary/70" aria-hidden />
            </div>
            <p className="mt-2 text-[1.625rem] font-semibold tabular-nums leading-none">{m.value}</p>
            {m.hint ? <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <OpusDataSurface className="overflow-hidden p-0">
            <Tabs defaultValue="appointments">
              <div className="border-b px-4 py-3">
                <TabsList className="h-9">
                  <TabsTrigger value="appointments">Upcoming appointments</TabsTrigger>
                  <TabsTrigger value="classes">Upcoming classes</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="appointments" className="m-0 p-0">
                <SchedulingCompactEmpty
                  icon={CalendarDays}
                  title="No upcoming appointments"
                  description="Open the calendar to see today’s schedule."
                  action={
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      className="h-9"
                      render={<Link href="/appointment-reminders" />}
                    >
                      Open calendar
                    </Button>
                  }
                />
              </TabsContent>
              <TabsContent value="classes" className="m-0 p-0">
                <SchedulingCompactEmpty
                  icon={GraduationCap}
                  title="No class sessions today"
                  description="Manage classes and enrollments from the classes catalog."
                  action={
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      className="h-9"
                      render={<Link href="/appointments/classes" />}
                    >
                      Classes
                    </Button>
                  }
                />
              </TabsContent>
            </Tabs>
          </OpusDataSurface>
        </section>
        <aside className="lg:col-span-4">
          <StorefrontReadinessPanel />
        </aside>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold leading-[1.625rem]">Recently created products</h2>
          <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/appointments/packages" />}>
            View all
          </Button>
        </div>
        {packages.length === 0 && !loading ? (
          <OpusDataSurface className="flex min-h-[13.75rem] items-center justify-center p-6">
            <EmptyState
              icon={Package}
              title="No packages yet"
              description="Create a package to start selling bundles."
              action={
                <Button nativeButton={false} render={<Link href="/appointments/packages/new" />}>
                  Create package
                </Button>
              }
            />
          </OpusDataSurface>
        ) : (
          <OpusDataSurface className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={OpusTh}>Offering</th>
                  <th scope="col" className={OpusTh}>Type</th>
                  <th scope="col" className={OpusTh}>Price</th>
                  <th scope="col" className={OpusTh}>Status</th>
                  <th scope="col" className={cn(OpusTh, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {packages.map((row) => {
                  const parsed = packageFormFromRow(row as Parameters<typeof packageFormFromRow>[0])
                  return (
                    <tr key={row.id} className="h-[4.5rem] hover:bg-muted/40">
                      <th scope="row" className={cn(OpusTd, 'py-2 font-normal')}>
                        <OfferingCatalogProductCell
                          href={`/appointments/packages/${row.id}`}
                          name={row.name}
                          description={row.description}
                          imageUrl={parsed.imageUrl}
                          category="package"
                        />
                      </th>
                      <td className={OpusTd}>Package</td>
                      <td className={OpusTd}>{formatMoney(row.priceCents)}</td>
                      <td className={OpusTd}>
                        <Pill tone={row.active ? 'success' : 'neutral'} dot={false}>
                          {row.active ? 'Active' : 'Draft'}
                        </Pill>
                      </td>
                      <td className={cn(OpusTd, 'text-right')}>
                        <Button nativeButton={false} variant="ghost" size="sm" render={<Link href={`/appointments/packages/${row.id}`} />}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </OpusDataSurface>
        )}
      </div>
    </ArOpusPage>
  )
}
