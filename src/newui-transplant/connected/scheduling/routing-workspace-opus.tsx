'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRoutingWorkspace } from '@/features/appointments/kimi/routing/use-routing-workspace'
import { TypeRoutingRulesPanel } from '@/features/appointments/kimi/routing/type-routing-rules-panel'
import { ROUTING_SECTIONS, type RoutingSectionId } from '@/components/appointments/routing/routing-section-types'
import { RoutingOverviewSection } from '@/components/appointments/routing/routing-overview-section'
import { RoutingRulesSection } from '@/components/appointments/routing/routing-rules-section'
import { RoutingPoolsSection } from '@/components/appointments/routing/routing-pools-section'
import { RoutingServicesSection } from '@/components/appointments/routing/routing-services-section'
import { RoutingTestSection } from '@/components/appointments/routing/routing-test-section'
import { RoutingActivitySection } from '@/components/appointments/routing/routing-activity-section'
import { RoutingSettingsSection } from '@/components/appointments/routing/routing-settings-section'
import { RoutingServiceDrawer } from '@/components/appointments/routing/routing-service-drawer'
import type { StaffRoutingConfig } from '@/lib/appointments/types'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Button } from '@/newui-transplant/components/ui/button'
import { Callout, PageHeader } from '@/newui-transplant/components/app/kit'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import '@/newui-transplant/connected/scheduling/availability-workspace-opus.css'

export function RoutingWorkspaceOpus() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = (searchParams.get('section') as RoutingSectionId) || 'overview'
  const ws = useRoutingWorkspace()
  const [serviceDrawerId, setServiceDrawerId] = useState<string | null>(null)
  const [priorityDraft, setPriorityDraft] = useState<string[] | null>(null)

  const setSection = useCallback(
    (id: RoutingSectionId) => {
      const q = new URLSearchParams(searchParams.toString())
      q.set('section', id)
      router.replace(`/appointments/routing?${q.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const priorityOrder = useMemo(() => {
    if (priorityDraft) return priorityDraft
    return ws.data?.staffRouting.workspaceStaffPriorityOrder?.length
      ? ws.data.staffRouting.workspaceStaffPriorityOrder
      : ws.data?.staff.map((s) => s.id) || []
  }, [priorityDraft, ws.data])

  const persistRouting = useCallback(
    async (patch: { staffRouting: StaffRoutingConfig; workspaceStaffPriorityOrder?: string[] }) => {
      await ws.saveWorkspaceRouting(patch)
      setPriorityDraft(null)
    },
    [ws],
  )

  if (ws.loading) {
    return (
      <ArOpusPage>
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
      </ArOpusPage>
    )
  }

  if (!ws.data) {
    return (
      <ArOpusPage>
        <Callout tone="error" title="Could not load routing">
          <Button type="button" variant="outline" size="sm" onClick={() => ws.reload()}>
            Retry
          </Button>
        </Callout>
      </ArOpusPage>
    )
  }

  const data = ws.data

  return (
    <ArOpusPage className="availability-opus-root">
      <PageHeader
        title="Routing"
        description="Control how eligible bookings are assigned to staff and resources."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => setSection('test')}>
            Test routing
          </Button>
        }
      />

      {ws.error ? <Callout tone="error" title="Error" className="mb-4">{ws.error}</Callout> : null}

      <Tabs value={section} onValueChange={(v) => setSection(v as RoutingSectionId)} className="mb-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {ROUTING_SECTIONS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="availability-opus-sections">
        {section === 'overview' && (
          <RoutingOverviewSection
            data={data}
            onEditDefault={() => setSection('rules')}
            onViewServices={() => setSection('services')}
            onViewActivity={() => setSection('activity')}
          />
        )}
        {section === 'rules' && (
          <RoutingRulesSection
            staffRouting={data.staffRouting}
            staff={data.staff}
            priorityOrder={priorityOrder}
            saving={ws.saving}
            onChange={(patch) => void persistRouting(patch)}
            onReorderPriority={(next) => {
              setPriorityDraft(next)
              void persistRouting({
                staffRouting: data.staffRouting,
                workspaceStaffPriorityOrder: next,
              })
            }}
          />
        )}
        {section === 'pools' && <RoutingPoolsSection data={data} />}
        {section === 'services' && (
          <RoutingServicesSection data={data} onSelect={(id) => setServiceDrawerId(id)} />
        )}
        {section === 'test' && (
          <RoutingTestSection
            data={data}
            simulating={ws.simulating}
            result={ws.simulateResult}
            onRun={(input) => void ws.runSimulate(input)}
          />
        )}
        {section === 'activity' && <RoutingActivitySection data={data} />}
        {section === 'settings' && (
          <RoutingSettingsSection
            staffRouting={data.staffRouting}
            saving={ws.saving}
            onChange={(patch) => void persistRouting(patch)}
          />
        )}
        {section === 'type-rules' && <TypeRoutingRulesPanel />}
      </div>

      <RoutingServiceDrawer serviceId={serviceDrawerId} data={data} onClose={() => setServiceDrawerId(null)} />
    </ArOpusPage>
  )
}
