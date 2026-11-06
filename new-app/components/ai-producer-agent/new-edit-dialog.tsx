'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AI_PRODUCER_AGENT_LABEL } from '@/lib/ai-producer-agent/flags'
import { RunProgress } from '@/components/ai-producer-agent/run-progress'

export type NewEditDialogSource = {
  sourceId: string
  kind: 'stream' | 'upload' | 'clip'
  projectId?: string
  clipId?: string
  title?: string
  rangeMs?: [number, number]
}

export function NewEditDialog({
  open,
  onOpenChange,
  defaultSources,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultSources: NewEditDialogSource[]
}) {
  const [outputType, setOutputType] = useState<'single_payoff' | 'montage' | 'story' | 'auto' | 'rough_cut'>('auto')
  const [platform, setPlatform] = useState<'tiktok' | 'shorts' | 'reels'>('tiktok')
  const [instruction, setInstruction] = useState('')
  const [runId, setRunId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setRunId(null)
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const submit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-producer-agent/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sources: outputType === 'rough_cut'
            ? (() => {
                const projectIds = [...new Set(defaultSources.map((s) => s.projectId).filter(Boolean))]
                if (projectIds.length !== 1) {
                  throw new Error('Just Chatting rough cut needs one full recording project, not a clip selection')
                }
                return [{ sourceId: 'recording', kind: 'upload' as const, projectId: projectIds[0] }]
              })()
            : defaultSources.map((s, i) => ({
                ...s,
                sourceId: s.sourceId || `src_${i}`,
              })),
          outputType: outputType === 'rough_cut' ? 'story' : outputType,
          ...(outputType === 'rough_cut' ? { editMode: 'just_chatting_rough_cut', targetLengthS: [180, 480] } : {}),
          platform,
          genre: 'irl_just_chatting',
          instruction: instruction.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { data?: { runId?: string }; error?: string }
      if (!res.ok) throw new Error(json.error || 'start_failed')
      setRunId(json.data?.runId ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'start_failed')
    } finally {
      setSubmitting(false)
    }
  }, [defaultSources, instruction, outputType, platform])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="ai-producer-agent-dialog">
        <DialogHeader>
          <DialogTitle>{AI_PRODUCER_AGENT_LABEL}</DialogTitle>
          <DialogDescription>
            Creates a new editable project from your footage. The existing AI Producer chat is unchanged.
          </DialogDescription>
        </DialogHeader>
        {runId ? (
          <RunProgress runId={runId} onDone={() => onOpenChange(false)} />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sources</Label>
              <p className="text-sm text-muted-foreground">
                {defaultSources.map((s) => s.title || s.clipId || s.projectId || s.sourceId).join(', ')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Output</Label>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={outputType}
                  onChange={(e) =>
                    setOutputType(e.target.value as 'single_payoff' | 'montage' | 'story' | 'auto' | 'rough_cut')
                  }
                >
                  <option value="auto">Auto (decide from footage)</option>
                  <option value="rough_cut">Just Chatting · rough cut (3–8 min)</option>
                  <option value="single_payoff">Single setup → payoff</option>
                  <option value="montage">Montage</option>
                  <option value="story">Story (multi-beat / sources)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Platform</Label>
                <select
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as 'tiktok' | 'shorts' | 'reels')}
                >
                  <option value="tiktok">TikTok</option>
                  <option value="shorts">Shorts</option>
                  <option value="reels">Reels</option>
                </select>
              </div>
            </div>
            {outputType === 'rough_cut' ? (
              <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground" data-testid="rough-cut-source-info">
                Uses the last 20 minutes of the project's original recording (not its extracted clips) (minimum 5 minutes). Creates one new editable 3–8 minute rough cut with complete thoughts, conservative dialogue cuts, no automatic posting or paid visual generation. Review all cuts before export.
              </p>
            ) : null}
            <div className="space-y-1">
              <Label>Optional instruction</Label>
              <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3} />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        {!runId ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={() => void submit()} data-testid="ai-producer-agent-submit">
              {submitting ? 'Starting…' : 'Start'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
