'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { WorkflowsList } from '@/components/appointments/kimi-ui/workflows/components/WorkflowsList'
import { Toast } from '@/components/appointments/kimi-ui/workflows/components/ui'
import type { WorkflowRecord } from '@/components/appointments/kimi-ui/workflows/types'
import type { AppointmentWorkflowRecord } from '@/lib/appointment-workflows/types'
import { PREBUILT_WORKFLOW_TEMPLATES } from '@/lib/appointment-workflows/templates'
import {
  mapApiWorkflowToKimi,
  mapPrebuiltTemplate,
} from '@/features/appointments/kimi/workflows/map-workflows'
import { Workflow } from 'lucide-react'
import { SchedulingOpusPage } from '@/newui-transplant/connected/scheduling/scheduling-opus-page'

export function WorkflowsListOpus() {
  const router = useRouter()
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const prebuiltTemplates = useMemo(
    () => PREBUILT_WORKFLOW_TEMPLATES.map(mapPrebuiltTemplate),
    [],
  )

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg(null), 2800)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/appointments/workflows')
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data?.workflows || []) as AppointmentWorkflowRecord[]
        setWorkflows(rows.map(mapApiWorkflowToKimi))
      })
      .catch(() => toast("Couldn't load workflows."))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(wf: WorkflowRecord) {
    await fetch(`/api/appointments/workflows/${wf.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !wf.active, status: !wf.active ? 'active' : 'paused' }),
    })
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === wf.id
          ? { ...w, active: !w.active, status: !w.active ? 'active' : 'paused' }
          : w,
      ),
    )
    toast(wf.active ? `"${wf.name}" paused.` : `"${wf.name}" activated.`)
  }

  async function duplicate(wf: WorkflowRecord) {
    const res = await fetch(`/api/appointments/workflows/${wf.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate' }),
    })
    const json = await res.json()
    if (json.data?.id) {
      router.push(`/appointments/workflows/${json.data.id}/edit`)
      return
    }
    toast("Couldn't duplicate workflow.")
  }

  async function remove(wf: WorkflowRecord) {
    await fetch(`/api/appointments/workflows/${wf.id}`, { method: 'DELETE' })
    setWorkflows((prev) => prev.filter((w) => w.id !== wf.id))
    toast(`"${wf.name}" deleted.`)
  }

  const installedByTemplate = new Map(
    workflows.filter((w) => w.templateId).map((w) => [w.templateId!, w]),
  )

  return (
    <SchedulingOpusPage
      icon={Workflow}
      title="Workflows"
      description="Automate appointment follow-up and operations."
    >
      <WorkflowsList
        workflows={workflows}
        loading={loading}
        prebuiltTemplates={prebuiltTemplates}
        onEdit={(wf) => router.push(`/appointments/workflows/${wf.id}/edit`)}
        onCreate={() => router.push('/appointments/workflows/new')}
        onSetupTemplate={(templateId) => {
          const installed = installedByTemplate.get(templateId)
          router.push(
            installed
              ? `/appointments/workflows/${installed.id}/edit`
              : `/appointments/workflows/setup/${templateId}`,
          )
        }}
        onToggleActive={toggleActive}
        onDuplicate={duplicate}
        onDelete={remove}
        toast={toast}
      />
      {toastMsg ? <Toast message={toastMsg} /> : null}
    </SchedulingOpusPage>
  )
}
