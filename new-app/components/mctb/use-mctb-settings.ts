'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export type MctbSettingsPayload = {
  numbers: { id: string; e164: string; label: string; mctb: { enabled: boolean; consentMode?: string } }[]
  recovery: {
    enabled: boolean
    active: boolean
    delaySeconds: number
    cooldownMinutes: number
    triggers: {
      noAnswer: boolean
      busy: boolean
      rejected: boolean
      unreachable: boolean
      voicemail: boolean
    }
    manuallyPaused: boolean
    pauseUntil: string | null
  }
  consent: { mode: string; defaultMode: string; attestation: { attestedAt: string | null } | null }
  template: { selectedId: string; templates: { id: string; name: string; preview: string }[] }
  recentActivity: unknown[]
  exclusions: { id: string; phone: string; reason: string; createdAt: string }[]
}

export function useMctbSettings() {
  const [data, setData] = useState<MctbSettingsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/phone/mctb', { cache: 'no-store' })
      const j = await res.json()
      if (!j.ok) throw new Error(j.error || 'load_failed')
      setData(j.data as MctbSettingsPayload)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load MCTB settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      setSaving(true)
      try {
        const res = await fetch('/api/phone/mctb', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const j = await res.json()
        if (!j.ok) throw new Error(j.error || 'save_failed')
        setData(j.data as MctbSettingsPayload)
        window.dispatchEvent(new Event('mctb-setup-updated'))
        return j.data as MctbSettingsPayload
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
        throw e
      } finally {
        setSaving(false)
      }
    },
    [],
  )

  return { data, loading, saving, reload, save }
}
