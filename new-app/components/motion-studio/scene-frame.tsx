'use client'

import { BarChart3, Film, ImageIcon, Map as MapIcon, Network, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MsScene } from '@/lib/motion-studio/types'

const ICON = { photo: ImageIcon, chart: BarChart3, text: Type, map: MapIcon, diagram: Network, footage: Film, interview: Film, cinematic: Film } as const

/**
 * Storyboard frame for a scene until a real render thumbnail exists. Uses tokens only
 * (panel well + lane hue for the visual type) so it reads as a placeholder, not a fake render.
 */
export function SceneFrame({ scene, small = false, className }: { scene: MsScene; small?: boolean; className?: string }) {
  if (scene.thumbnailUrl) {
    return <img src={scene.thumbnailUrl} alt="" className={cn('size-full object-cover', className)} draggable={false} />
  }
  const Icon = ICON[scene.visualType] ?? Film
  const hue = scene.visualType === 'footage' || scene.visualType === 'interview' ? 'text-lane-broll' : scene.visualType === 'chart' ? 'text-lane-music' : scene.visualType === 'photo' ? 'text-lane-caption' : 'text-lane-ai'
  return (
    <div className={cn('relative grid size-full place-items-center overflow-hidden bg-panel', className)} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,var(--surface-raised),transparent_70%)] opacity-80" />
      <div className="absolute inset-x-[12%] bottom-[18%] h-px bg-foreground/10" />
      <div className="relative flex flex-col items-center gap-1 px-2 text-center">
        <Icon className={cn(small ? 'size-4' : 'size-8', hue)} />
        {!small ? <p className="max-w-[80%] text-sm font-medium text-foreground/90 text-balance">{scene.title}</p> : null}
      </div>
    </div>
  )
}
