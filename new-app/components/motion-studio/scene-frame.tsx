'use client'

import { cn } from '@/lib/utils'
import type { MsScene } from '@/lib/motion-studio/types'
import { MotionPoster } from './motion-poster'

/**
 * Storyboard / preview frame for a scene. Uses the real render thumbnail when the backend provides one,
 * otherwise a code-rendered poster frame for the scene's visual type (chart, photo with Ken Burns, title card,
 * map, diagram, footage). Nothing is fetched or generated.
 */
export function SceneFrame({ scene, small = false, animate = false, className }: { scene: MsScene; small?: boolean; animate?: boolean; className?: string }) {
  if (scene.thumbnailUrl) {
    return <img src={scene.thumbnailUrl} alt="" className={cn('size-full object-cover', className)} draggable={false} />
  }
  return (
    <div className={cn('relative size-full overflow-hidden bg-panel', className)}>
      <MotionPoster kind={scene.visualType} seed={scene.id} title={scene.title} eyebrow={scene.graphicName} small={small} animate={animate} />
    </div>
  )
}
