'use client'

import { createContext, useContext, useEffect } from 'react'
import type { HeadlineAssInput } from '@/lib/clips/render-plan/headline-ass'
import type { BadgeTextInput } from '@/lib/clips/render-plan/badge-ass'

/**
 * EP2: DOM overlays that already compute the export geometry (stream headline band, badge sprite
 * rect) publish their play-space inputs here; PreviewStage turns them into .ass for libass-wasm.
 * Outside PreviewStage (export dialog, layout studio) there is no provider and nothing happens.
 */
export type LibassSink = {
  headline: (v: Omit<HeadlineAssInput, 'durationMs'> | null) => void
  badge: (v: BadgeTextInput | null) => void
}

export const LibassSinkContext = createContext<LibassSink | null>(null)

export function usePublishLibass<K extends keyof LibassSink>(kind: K, value: Parameters<LibassSink[K]>[0]): void {
  const sink = useContext(LibassSinkContext)
  const key = value ? JSON.stringify(value) : ''
  useEffect(() => {
    if (!sink) return
    ;(sink[kind] as (v: unknown) => void)(key ? JSON.parse(key) : null)
    return () => (sink[kind] as (v: unknown) => void)(null)
  }, [sink, kind, key])
}

/** Render-anywhere form of usePublishLibass (safe after early returns). */
export function LibassPublish<K extends keyof LibassSink>({ kind, value }: { kind: K; value: Parameters<LibassSink[K]>[0] }) {
  usePublishLibass(kind, value)
  return null
}
