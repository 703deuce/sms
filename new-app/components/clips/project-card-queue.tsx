'use client'

import { useEffect, useState } from 'react'
import { formatClipQueueHint } from '@/lib/clips/progress-eta-label'
import { getProjectStatus } from '@/lib/clips-api'

export function ProjectCardQueueHint({ projectId, processing }: { projectId: string; processing: boolean }) {
  const [hint, setHint] = useState('')

  useEffect(() => {
    if (!processing) {
      setHint('')
      return
    }
    let cancelled = false
    const tick = () => {
      void getProjectStatus(projectId)
        .then((data) => {
          if (cancelled) return
          if (data.waitingForWorker) {
            setHint(formatClipQueueHint(data.queueAhead) || ' · Queued')
          } else {
            setHint('')
          }
        })
        .catch(() => {})
    }
    tick()
    const t = setInterval(tick, 8000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [projectId, processing])

  if (!hint) return null
  return (
    <span className="mt-0.5 block text-center text-[10px] font-medium tabular-nums text-white/90">{hint}</span>
  )
}
