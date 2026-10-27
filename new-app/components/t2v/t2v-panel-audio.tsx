'use client'

import { useState, type MutableRefObject } from 'react'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { T2vPanelVoice } from '@/components/t2v/t2v-panel-voice'
import { T2vPanelMusic } from '@/components/t2v/t2v-panel-music'
import { cn } from '@/lib/utils'

export function T2vPanelAudio({
  draftId,
  doc,
  revisionRef,
  setRevision,
  replace,
  onChange,
}: {
  draftId: string
  doc: T2vDraftV1
  revisionRef: MutableRefObject<number>
  setRevision: (n: number) => void
  replace: (next: T2vDraftV1) => void
  onChange: (next: T2vDraftV1) => void
}) {
  const [seg, setSeg] = useState<'voice' | 'music'>('voice')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1 border-b border-border p-2">
        {(['voice', 'music'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={cn('flex-1 rounded-md py-1.5 text-xs capitalize', seg === s ? 'bg-muted font-medium' : '')}
            onClick={() => setSeg(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {seg === 'voice' ? (
        <T2vPanelVoice doc={doc} onChange={onChange} />
      ) : (
        <T2vPanelMusic
          draftId={draftId}
          doc={doc}
          revisionRef={revisionRef}
          setRevision={setRevision}
          replace={replace}
          onChange={onChange}
        />
      )}
    </div>
  )
}
