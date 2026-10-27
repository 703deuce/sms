'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PrimaryButton } from '@/components/app/primary-button'

export function T2vVoiceCloneModal({
  open,
  onClose,
  sampleUploadId,
}: {
  open: boolean
  onClose: () => void
  sampleUploadId: string | null
}) {
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const submit = async () => {
    if (!sampleUploadId || !consent || !name.trim()) {
      toast.error('Name, sample audio, and consent are required')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/t2v/voices/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), sampleUploadId, consent: true }),
      })
      const body = await res.json()
      if (res.status === 202) {
        toast.success('Clone queued — you can use it when processing finishes')
        onClose()
        return
      }
      if (res.status === 503) {
        toast.message('Voice clone worker is not live yet — your request contract is queued for Agent B')
        onClose()
        return
      }
      throw new Error(body.error ?? 'clone_failed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start clone')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-labelledby="clone-title">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg">
        <h2 id="clone-title" className="text-lg font-semibold">Clone your voice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record 30–60 seconds of clear speech. We only use this sample to create your ElevenLabs voice.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="clone-name">Voice name</Label>
            <Input id="clone-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My voice" />
          </div>
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Consent</p>
              <p className="text-xs text-muted-foreground">I confirm I have the right to clone this voice and agree to storage.</p>
            </div>
            <Switch checked={consent} onCheckedChange={setConsent} aria-label="Consent to voice clone" />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <PrimaryButton disabled={busy || !sampleUploadId} onClick={() => void submit()}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create clone
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
