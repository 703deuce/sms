'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/app/page-primitives'
import { Textarea } from '@/components/ui/textarea'
import { SimpleSelect } from '@/components/app/filters'

type CadenceStep = { type: 'wait' | 'call' | 'sms' | 'email'; waitMinutes?: number; body?: string; subject?: string }
type Cadence = { id: string; name: string; status: string; stepsJson: CadenceStep[]; stopRulesJson?: unknown }
type Enrollment = {
  id: string
  status: string
  currentStepIndex: number
  nextStepAt: string | null
  contact: { id: string; firstName: string | null; lastName: string | null; phone: string }
}

export function CadencesSettingsPanel() {
  const [cadences, setCadences] = useState<Cadence[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [stepsText, setStepsText] = useState('[]')
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [enrollContactId, setEnrollContactId] = useState('')

  const load = useCallback(async () => {
    const r = await fetch('/api/phone/power-dialer/cadences')
    const j = await r.json()
    setCadences((j.data || []).map((c: Cadence) => ({ ...c, stepsJson: c.stepsJson || [] })))
  }, [])

  const loadEnrollments = useCallback(async (cadenceId: string) => {
    const r = await fetch(`/api/phone/power-dialer/cadences/${cadenceId}/enrollments`)
    const j = await r.json()
    setEnrollments(j.data || [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) return
    const c = cadences.find((x) => x.id === selectedId)
    if (!c) return
    setDraftName(c.name)
    setStepsText(JSON.stringify(c.stepsJson || [], null, 2))
    void loadEnrollments(selectedId)
  }, [selectedId, cadences, loadEnrollments])

  const createCadence = async () => {
    const res = await fetch('/api/phone/power-dialer/cadences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draftName || 'New cadence',
        stepsJson: [{ type: 'wait', waitMinutes: 60 }, { type: 'call' }],
        stopRulesJson: { onReply: true, onOptOut: true },
      }),
    })
    if (!res.ok) {
      toast.error('Could not create cadence')
      return
    }
    toast.success('Cadence created')
    await load()
  }

  const saveCadence = async () => {
    if (!selectedId) return
    let steps: CadenceStep[]
    try {
      steps = JSON.parse(stepsText) as CadenceStep[]
    } catch {
      toast.error('Steps JSON is invalid')
      return
    }
    const res = await fetch(`/api/phone/power-dialer/cadences/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: draftName, stepsJson: steps, stopRulesJson: { onReply: true, onOptOut: true } }),
    })
    if (!res.ok) {
      toast.error('Save failed')
      return
    }
    toast.success('Cadence saved')
    await load()
  }

  const enroll = async () => {
    if (!selectedId || !enrollContactId.trim()) return
    const res = await fetch(`/api/phone/power-dialer/cadences/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'enroll', contactId: enrollContactId.trim() }),
    })
    if (!res.ok) {
      toast.error('Enrollment failed')
      return
    }
    toast.success('Contact enrolled')
    setEnrollContactId('')
    void loadEnrollments(selectedId)
  }

  const pauseResume = async (enrollmentId: string, action: 'pause' | 'resume') => {
    if (!selectedId) return
    await fetch(`/api/phone/power-dialer/cadences/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, enrollmentId }),
    })
    void loadEnrollments(selectedId)
  }

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Cadences" description="Call, SMS, email, and wait steps with enrollments from dispositions or manual enroll.">
        <div className="mb-4 flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="New cadence name" value={draftName} onChange={(e) => setDraftName(e.target.value)} aria-label="Cadence name" />
          <Button type="button" size="sm" onClick={() => void createCadence()}>Create cadence</Button>
        </div>
        <SimpleSelect
          label="Select cadence"
          value={selectedId || ''}
          onChange={(v) => setSelectedId(v || null)}
          options={[{ value: '', label: 'Choose…' }, ...cadences.map((c) => ({ value: c.id, label: c.name }))]}
        />
        {selectedId && (
          <div className="mt-4 grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Steps (JSON)</span>
              <Textarea className="min-h-[160px] font-mono text-xs" value={stepsText} onChange={(e) => setStepsText(e.target.value)} aria-label="Cadence steps JSON" />
              <span className="text-xs text-muted-foreground">Types: wait, call, sms, email. Example: wait 60m then call.</span>
            </label>
            <Button type="button" size="sm" className="self-start" onClick={() => void saveCadence()}>Save cadence</Button>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Enroll contact by ID</span>
              <div className="flex gap-2">
                <Input value={enrollContactId} onChange={(e) => setEnrollContactId(e.target.value)} placeholder="Contact ID" aria-label="Contact ID to enroll" />
                <Button type="button" size="sm" variant="outline" onClick={() => void enroll()}>Enroll</Button>
              </div>
            </label>
            <div>
              <h3 className="mb-2 text-sm font-medium">Enrollments</h3>
              {enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No enrollments yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {enrollments.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        {e.contact.firstName} {e.contact.lastName} · {e.contact.phone} · step {e.currentStepIndex + 1} · {e.status}
                      </span>
                      <div className="flex gap-1">
                        {e.status === 'active' && (
                          <Button type="button" size="sm" variant="outline" onClick={() => void pauseResume(e.id, 'pause')}>Pause</Button>
                        )}
                        {e.status === 'paused' && (
                          <Button type="button" size="sm" variant="outline" onClick={() => void pauseResume(e.id, 'resume')}>Resume</Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
