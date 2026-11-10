'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  createStudioController,
  type CreateStudioControllerOptions,
  type StudioController,
  type StudioSessionState,
} from '../../lib/ai-studio/controller'

export function useAiStudio(opts: CreateStudioControllerOptions = {}): {
  state: StudioSessionState
  controller: StudioController
} {
  const optsRef = useRef(opts)
  optsRef.current = opts
  const controllerRef = useRef<StudioController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = opts.client
      ? createStudioController(opts)
      : createStudioController(opts)
  }
  const controller = controllerRef.current
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  )
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void controller.load().then(() => setReady(true))
    return () => controller.destroy()
    // Fresh controller is created once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller])
  void ready
  return { state, controller }
}
