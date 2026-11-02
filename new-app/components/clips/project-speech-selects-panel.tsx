'use client'

import { useState } from 'react'
import { SpeechSearchSection } from '@/components/clips/editor/speech-search-section'
import { ProjectSelectsBin, useProjectSelectsActions } from '@/components/clips/editor/project-selects-bin'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

/** Q5: speech search + selects on the project grid (assemble in editor Media panel). */
export function ProjectSpeechSelectsPanel({
  projectId,
  editorHref,
  stubEdits,
  mediaStub,
}: {
  projectId: string
  editorHref: string | null
  stubEdits: ClipEditsV2
  mediaStub: ProjectMediaApi
}) {
  const [tick, setTick] = useState(0)
  const addToSelects = useProjectSelectsActions(projectId, () => setTick((n) => n + 1))

  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="project-speech-selects">
      <SpeechSearchSection
        projectId={projectId}
        edits={stubEdits}
        media={mediaStub}
        playheadSourceMs={0}
        onSeekSource={() => {}}
        onEdits={() => {}}
        onAddToSelects={addToSelects}
      />
      <ProjectSelectsBin
        key={tick}
        projectId={projectId}
        edits={stubEdits}
        mediaItems={mediaStub.items}
        onAssemble={() => {}}
      />
      {editorHref ? (
        <Button size="sm" variant="secondary" asChild data-testid="project-assemble-in-editor">
          <Link href={editorHref}>Assemble in editor → Media</Link>
        </Button>
      ) : null}
    </div>
  )
}
