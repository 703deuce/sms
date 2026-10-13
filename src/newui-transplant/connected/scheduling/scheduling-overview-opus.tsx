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
import { ArOpusPage, ArStatGrid, OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusListControls,
  OpusMetricBand,
  OpusSchedulingHero,
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Button } from '@/newui-transplant/components/ui/button'
import { Callout, EmptyState, Stat } from '@/newui-transplant/components/app/kit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import { formatMoney } from '@/lib/appointments/packages/package-form'
import { cn } from '@/lib/utils'

type Stats = {
  activePackages: number
  customerPackages: number
  packageRevenueCents: number
}

type PackageRow = { id: string; name: string; priceCents: number; active: boolean }

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
        setPackages((listJson.data || []).slice(0, 8))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={CalendarDays}
        title="Scheduling"
        description="Sell packages, run classes, and keep bookings on track."
        actions={
          <>
            <Button asChild>
              <Link href="/appointments/sell">
                <Plus className="mr-2 size-4" aria-hidden />
                Create
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/appointments/booking/share">
                <ExternalLink className="mr-2 size-4" aria-hidden />
                Booking page
              </Link>
            </Button>
          </>
        }
      />

      <OpusMetricBand>
        <ArStatGrid>
          <Stat
            label="Active packages"
            value={loading ? '—' : String(stats?.activePackages ?? 0)}
            icon={Package}
          />
          <Stat
            label="Package owners"
            value={loading ? '—' : String(stats?.customerPackages ?? 0)}
            icon={TrendingUp}
          />
          <Stat
            label="Class enrollments"
            value="—"
            icon={GraduationCap}
            hint="Connect classes workspace for live count"
          />
          <Stat
            label="Package revenue"
            value={loading ? '—' : formatMoney(stats?.packageRevenueCents ?? 0)}
            icon={TrendingUp}
          />
        </ArStatGrid>
      </OpusMetricBand>

      <div className="mb-8 grid gap-6 lg:grid-cols-12">
        <section className="lg:col-span-8">
          <OpusDataSurface
            toolbar={
              <Tabs defaultValue="appointments">
                <TabsList>
                  <TabsTrigger value="appointments">Upcoming appointments</TabsTrigger>
                  <TabsTrigger value="classes">Upcoming classes</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            <Tabs defaultValue="appointments">
              <TabsContent value="appointments" className="p-4">
                <EmptyState
                  icon={CalendarDays}
                  title="No upcoming appointments"
                  description="Open the calendar to see today’s schedule."
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/appointment-reminders">Open calendar</Link>
                    </Button>
                  }
                />
              </TabsContent>
              <TabsContent value="classes" className="p-4">
                <EmptyState
                  icon={GraduationCap}
                  title="No class sessions today"
                  description="Manage classes and enrollments from the classes workspace."
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/appointments/classes">Classes</Link>
                    </Button>
                  }
                />
              </TabsContent>
            </Tabs>
          </OpusDataSurface>
        </section>
        <aside className="lg:col-span-4">
          <Callout tone="info" title="Storefront & payments">
            <p className="text-sm">Publish packages and connect Stripe before selling online.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/appointments/commerce">Commerce hub</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/appointments/pricing-payments">Payments</Link>
              </Button>
            </div>
          </Callout>
        </aside>
      </div>

      <OpusListControls>
        <h2 className="text-lg font-semibold">Recently created products</h2>
      </OpusListControls>
      {packages.length === 0 && !loading ? (
        <EmptyState
          icon={Package}
          title="No packages yet"
          description="Create a package to start selling bundles."
          action={
            <Button asChild>
              <Link href="/appointments/packages/new">Create package</Link>
            </Button>
          }
        />
      ) : (
        <OpusDataSurface className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={OpusTh}>Name</th>
                <th scope="col" className={OpusTh}>Type</th>
                <th scope="col" className={OpusTh}>Price</th>
                <th scope="col" className={OpusTh}>Status</th>
                <th scope="col" className={cn(OpusTh, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {packages.map((row) => (
                <tr key={row.id} className="min-h-16 hover:bg-muted/40">
                  <th scope="row" className={cn(OpusTd, 'font-normal')}>
                    <Link href={`/appointments/packages/${row.id}`} className="font-medium text-primary">
                      {row.name}
                    </Link>
                  </th>
                  <td className={OpusTd}>Package</td>
                  <td className={OpusTd}>{formatMoney(row.priceCents)}</td>
                  <td className={OpusTd}>{row.active ? 'Active' : 'Draft'}</td>
                  <td className={cn(OpusTd, 'text-right')}>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/appointments/packages/${row.id}`}>Manage</Link>
                    </Button>
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
