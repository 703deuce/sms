'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Dropzone } from '@/components/clips/dropzone'
import { uploadClipFile } from '@/lib/clips/upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { T2vFocalCropModal } from '@/components/t2v/t2v-focal-crop-modal'
import { T2vSceneMediaDialog } from '@/components/t2v/t2v-scene-media-dialog'
import type { T2vDraftV1 } from '@/lib/t2v/types'

type Candidate = { provider: string; providerId: string; thumbUrl?: string }

export function T2vPanelVisuals({
  draftId,
  doc,
  sceneId,
  onRefresh,
}: {
  draftId: string
  doc: T2vDraftV1
  sceneId: string | null
  onRefresh: () => void
}) {
  const scene = doc.scenes.find((s) => s.id === sceneId)
  const [q, setQ] = useState(scene?.visualQuery ?? '')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [focalOpen, setFocalOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)

  useEffect(() => {
    if (scene) setQ(scene.visualQuery)
  }, [scene?.id, scene?.visualQuery])

  useEffect(() => {
    if (!sceneId) return
    void fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/media?q=${encodeURIComponent(q)}&type=video`)
      .then((r) => r.json())
      .then((b) => setCandidates(b.data?.candidates ?? []))
      .catch(() => setCandidates([]))
  }, [draftId, sceneId, q])

  if (!scene) {
    return <p className="p-4 text-sm text-muted-foreground">Select a scene to edit visuals.</p>
  }

  const applyStock = async (pick: Candidate) => {
    const res = await fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'replace', media: { provider: pick.provider, providerId: pick.providerId } }),
    })
    if (!res.ok) {
      toast.error('Could not replace media')
      return
    }
    toast.success('Visual updated')
    onRefresh()
  }

  const saveFocal = async (focalX: number, focalY: number) => {
    await fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'focal', focalX, focalY }),
    })
    setFocalOpen(false)
    onRefresh()
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        {scene.media.thumbUrl ? (
          <Image src={scene.media.thumbUrl} alt="" fill className="object-cover" unoptimized />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setFocalOpen(true)}>Crop &amp; focus</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setAiOpen(true)}>AI / more</Button>
      </div>
      <Label>Stock search</Label>
      <Input value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        {candidates.slice(0, 8).map((c) => (
          <button
            key={`${c.provider}-${c.providerId}`}
            type="button"
            className="relative aspect-video overflow-hidden rounded border border-border"
            onClick={() => void applyStock(c)}
          >
            {c.thumbUrl ? <Image src={c.thumbUrl} alt="" fill className="object-cover" unoptimized /> : null}
          </button>
        ))}
      </div>
      <div>
        <Label className="mb-2 block">Upload</Label>
        <Dropzone
          onFile={(file) => {
            void uploadClipFile(file, (p) => {
              if (p.state === 'complete' && p.uploadId) {
                void fetch(`/api/t2v/drafts/${draftId}/scenes/${sceneId}/media`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'upload', uploadId: p.uploadId }),
                }).then(() => {
                  toast.success('Upload applied')
                  onRefresh()
                })
              }
            })
          }}
        />
      </div>
      <T2vFocalCropModal
        open={focalOpen}
        imageUrl={scene.media.previewUrl ?? scene.media.thumbUrl ?? ''}
        focalX={scene.media.focalX ?? 0.5}
        focalY={scene.media.focalY ?? 0.5}
        onClose={() => setFocalOpen(false)}
        onSave={(x, y) => void saveFocal(x, y)}
      />
      {aiOpen && sceneId ? (
        <T2vSceneMediaDialog
          open
          draftId={draftId}
          sceneId={sceneId}
          defaultPrompt={scene.visualQuery}
          onClose={() => setAiOpen(false)}
          onQueued={onRefresh}
        />
      ) : null}
    </div>
  )
}
